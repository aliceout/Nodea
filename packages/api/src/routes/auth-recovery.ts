import { eq } from 'drizzle-orm';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  RecoverKekFinishBodySchema,
  RecoverKekStartBodySchema,
  RecoverKekStartResponseSchema,
  RecoverKekVerifyBodySchema,
  RecoverKekVerifyResponseSchema,
  RecoveryCodeUpsertBodySchema,
  RecoveryCodeVerifyBodySchema,
  RecoveryCodeVerifyResponseSchema,
  type RecoverKekStartResponse,
} from '@nodea/shared';
import { getConfig } from '../config.ts';
import { db } from '../db/client.ts';
import { opaqueRecords, users } from '../db/schema.ts';
import {
  createRegistrationResponse,
  opaqueReady,
} from '../auth/opaque.ts';
import {
  consumeRecoverPending,
  storeRecoverPending,
} from '../auth/opaque-recover-state.ts';
import {
  createSession,
  revokeAllUserSessions,
} from '../auth/session.ts';
import { setSessionCookie } from '../auth/cookies.ts';
import { cancelPendingBypassesForUser } from '../auth/mfa-bypass.ts';
import { getEmailService } from '../services/email/index.ts';
import { renderRecoveryAppliedEmail } from '../services/email/templates/recovery-applied.ts';
import { extractEmailLanguage } from '../services/email/i18n.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser } from '../middleware/require-user.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  okContent,
  z,
} from '../openapi/index.ts';

/**
 * Recovery-code KEK routes (Auth-Roadmap Phase 3, Auth-Spec §7.7).
 *
 * Three endpoints:
 *
 *   - `POST /auth/security/recovery-code` (authenticated) — first-
 *     time setup OR regenerate. The client generates a fresh
 *     12-word BIP39 mnemonic, derives a wrap key from the entropy
 *     via HKDF, wraps the user's KEK, computes
 *     `SHA-256(entropy)` as the anti-DoS hash. Body shape is the
 *     same in both cases; the server gates on whether
 *     `users.recovery_code_hash IS NULL`. Regenerate requires the
 *     OPAQUE password proof.
 *
 *   - `POST /auth/recover-kek/start` (anonymous) — kicks off the
 *     2-step recover flow when the user forgot their password.
 *     Returns the `wrappedKekRecovery` blobs + an OPAQUE
 *     `registrationResponse` for the new password + a single-use
 *     `recoverSessionId`. Anti-enum: unknown emails get fresh
 *     random blobs that the client can't unwrap.
 *
 *   - `POST /auth/recover-kek/finish` (anonymous) — consumes the
 *     session, validates the recovery-code hash in constant time,
 *     replaces every credential blob in a transaction, mints a
 *     fresh session.
 */
export const authRecoveryRoutes = makeAuthedRouter();

const recoverLimiter = rateLimit({
  max: 5,
  windowMs: 60 * 60_000,
  keyPrefix: 'recover-kek',
});

// /verify is a pure hash-comparison oracle ; cap aggressively so a
// known email can't be brute-forced into revealing its mnemonic
// hash. 3 attempts/hour mirrors the slowest rate at which a real
// user might be typing 12 words wrong + retrying (typically once or
// twice before checking their backup).
const verifyLimiter = rateLimit({
  max: 3,
  windowMs: 60 * 60_000,
  keyPrefix: 'recover-kek-verify',
});

const recoverySetupLimiter = rateLimit({
  max: 5,
  windowMs: 60 * 60_000,
  keyPrefix: 'recovery-code-setup',
});

// Periodic re-verify (Phase 3B). Authenticated user checking their OWN
// hash, so there's no enum/oracle value in a hit — the cap just keeps a
// fumbling user (or a runaway client) from hammering the row. 10/h is
// generous for someone mistyping 12 words a few times.
//
// Keyed on the authenticated user id (the route mounts it AFTER
// `requireUser`), NOT the IP — same convention as `changeEmailLimiter`
// (audit 2026-06): an IP bucket would make several users behind one NAT
// share the budget and let a fumbling user 429 their neighbours, while
// not actually throttling one specific account.
const recoveryReverifyLimiter = rateLimit({
  max: 10,
  windowMs: 60 * 60_000,
  keyPrefix: 'recovery-code-verify-streak',
  keyFn: (c) => {
    const user = c.get('user') as { id?: string } | undefined;
    return user?.id ?? null;
  },
});

const RecoverySetupResponseSchema = z.object({
  ok: z.literal(true),
  regenerated: z.boolean(),
});

const setupRoute = createRoute({
  method: 'post',
  path: '/security/recovery-code',
  tags: ['auth-recovery'],
  summary: 'Setup or regenerate recovery code (re-auth gated)',
  middleware: [requireUser, requireFreshPassword, recoverySetupLimiter] as const,
  request: {
    body: { content: { 'application/json': { schema: RecoveryCodeUpsertBodySchema } } },
  },
  responses: {
    200: jsonContent(RecoverySetupResponseSchema, 'Recovery code stored'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated or stale re-auth'),
    429: errorContent('Rate limit exceeded'),
  },
});

const reverifyRoute = createRoute({
  method: 'post',
  path: '/security/recovery-code-verify',
  tags: ['auth-recovery'],
  summary: 'Periodic re-verify of the recovery phrase (authenticated)',
  middleware: [requireUser, recoveryReverifyLimiter] as const,
  request: {
    body: { content: { 'application/json': { schema: RecoveryCodeVerifyBodySchema } } },
  },
  responses: {
    200: jsonContent(RecoveryCodeVerifyResponseSchema, 'Phrase re-verified, streak advanced'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated or hash mismatch'),
    429: errorContent('Rate limit exceeded'),
  },
});

const recoverStartRoute = createRoute({
  method: 'post',
  path: '/recover-kek/start',
  tags: ['auth-recovery'],
  summary: 'Recover KEK — step 1 (anonymous, anti-enum)',
  middleware: [recoverLimiter] as const,
  request: {
    body: { content: { 'application/json': { schema: RecoverKekStartBodySchema } } },
  },
  responses: {
    200: jsonContent(RecoverKekStartResponseSchema, 'Recovery blobs + OPAQUE response'),
    400: errorContent('Invalid body'),
    429: errorContent('Rate limit exceeded'),
  },
});

const recoverFinishRoute = createRoute({
  method: 'post',
  path: '/recover-kek/finish',
  tags: ['auth-recovery'],
  summary: 'Recover KEK — step 2 (rotate credentials, mint session)',
  middleware: [recoverLimiter] as const,
  request: {
    body: { content: { 'application/json': { schema: RecoverKekFinishBodySchema } } },
  },
  responses: {
    200: okContent('Recovery completed'),
    400: errorContent('Invalid body'),
    401: errorContent('Invalid credentials'),
    429: errorContent('Rate limit exceeded'),
  },
});

const recoverVerifyRoute = createRoute({
  method: 'post',
  path: '/recover-kek/verify',
  tags: ['auth-recovery'],
  summary: 'Recover KEK — pre-step (verify email + code hash, issue #48)',
  middleware: [verifyLimiter] as const,
  request: {
    body: { content: { 'application/json': { schema: RecoverKekVerifyBodySchema } } },
  },
  responses: {
    200: jsonContent(RecoverKekVerifyResponseSchema, 'Code matches'),
    400: errorContent('Invalid body'),
    401: errorContent('Invalid credentials'),
    429: errorContent('Rate limit exceeded'),
  },
});

/* ============================================================================
 * Shared helpers
 * ========================================================================== */

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/* ============================================================================
 * POST /auth/security/recovery-code
 * Setup or regenerate the recovery code (authenticated).
 *
 * Re-auth gate: `requireFreshPassword` (Phase 7B). First-time setup
 * happens right after register, when the new full session is
 * stamped fresh — middleware passes naturally. Regenerate from
 * Settings goes through the standard re-auth modal first.
 * ========================================================================== */

authRecoveryRoutes.openapi(setupRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = RecoveryCodeUpsertBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const user = c.get('user');

  const isRegenerate = user.recoveryCodeHash !== null;

  await db
    .update(users)
    .set({
      wrappedKekRecovery: body.wrappedKekRecovery,
      wrappedKekRecoveryIv: body.wrappedKekRecoveryIv,
      recoveryCodeHash: body.recoveryCodeHash,
      recoveryAcknowledgedAt: new Date(),
      // New phrase = fresh re-verify anchor, ladder restarts at 0
      // (Phase 3B). The acknowledgement modal IS the first proof.
      recoveryVerifiedAt: new Date(),
      recoveryVerifyStreak: 0,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return c.json({ ok: true as const, regenerated: isRegenerate }, 200);
});

/* ============================================================================
 * POST /auth/security/recovery-code-verify
 * Periodic re-verify (Phase 3B, Auth-Spec §7.7). The authenticated user
 * re-types their existing phrase; the client ships only SHA-256(entropy).
 * On a match we stamp the verify anchor + bump the streak, which lengthens
 * the next backoff window (6 wk → 3 mo → 6 mo → 1 yr).
 *
 * No re-auth gate: this reads + advances counters, it never rotates a wrap.
 * No anti-enum dummy: the comparison is against the caller's OWN hash, so a
 * hit/miss leaks nothing about other accounts. Failure is a calm client-side
 * escalation toward « regenerate your phrase » — the server just says 401.
 * ========================================================================== */

authRecoveryRoutes.openapi(reverifyRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = RecoveryCodeVerifyBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const user = c.get('user');

  // No code on file (never set, or consumed by a recover-kek finish) →
  // nothing to verify against. Same 401 shape as a mismatch.
  if (user.recoveryCodeHash === null) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  // Constant-time even though it's the user's own hash — don't leak how
  // many leading hex chars matched. Mismatch logged as an aggregated
  // counter only (no per-user id in stdout — SEC-06).
  if (!constantTimeEqualHex(user.recoveryCodeHash, body.recoveryCodeHash)) {
    console.warn('[auth/recovery-code-verify] hash_mismatch');
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  const nextStreak = user.recoveryVerifyStreak + 1;
  await db
    .update(users)
    .set({
      recoveryVerifiedAt: new Date(),
      recoveryVerifyStreak: nextStreak,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return c.json({ ok: true as const, streak: nextStreak }, 200);
});

/* ============================================================================
 * POST /auth/recover-kek/verify
 * Pre-step (issue #48). Confirms an `(email, recoveryCodeHash)`
 * pair is valid BEFORE the user picks a new password. Anonymous,
 * anti-enum, aggressively rate-limited.
 *
 * Stateless : returns 200 `{ ok: true }` on a hit and 401
 * `invalid_credentials` on any miss. Does NOT issue a token —
 * `/start` + `/finish` still gate their own rotation, this route
 * only lets the SPA stop blocking the user behind a 12-word form
 * coupled to a new-password form.
 * ========================================================================== */

authRecoveryRoutes.openapi(recoverVerifyRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = RecoverKekVerifyBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const email = body.email.toLowerCase();

  const [user] = await db
    .select({ recoveryCodeHash: users.recoveryCodeHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Anti-enum: same failure shape and same time budget for unknown
  // email, known-without-recovery, and hash mismatch. We always
  // run the timing-safe compare so the cost of the comparison is
  // paid even when the user wasn't found ; pass a deterministic
  // dummy hash on the miss path to keep the branches symmetrical.
  const storedHash =
    user?.recoveryCodeHash ?? '0'.repeat(64);
  const match = constantTimeEqualHex(storedHash, body.recoveryCodeHash);
  if (!user || user.recoveryCodeHash === null || !match) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  return c.json({ ok: true as const }, 200);
});

/* ============================================================================
 * POST /auth/recover-kek/start
 * Anonymous, anti-enum. Returns wrappedKekRecovery + OPAQUE
 * registrationResponse + recoverSessionId.
 * ========================================================================== */

interface FakeBlobs {
  wrappedKekRecovery: string;
  wrappedKekRecoveryIv: string;
  userId: string;
}

/**
 * Generate fresh random base64-shaped blobs of the right
 * lengths so the response for an unknown email is byte-shape-
 * indistinguishable from a real one. The client will fail to
 * unwrap them with whatever recovery code they typed — no
 * server log of the mismatch.
 *
 * Real `wrappedKekRecovery` is AES-GCM(KEK, …) → 32-byte KEK +
 * 16-byte tag = 48 bytes ciphertext → 64 chars base64.
 * IV is 12 bytes → 16 chars base64.
 *
 * **userId determinism (audit v2.8.0).** Before, the fake userId
 * used `randomUUID()` and was therefore different on every call —
 * an attacker who hit `/recover-kek/start` twice with the same
 * unknown email got two different userIds, whereas the same call
 * for a known email returned the real (stable) `users.id`. That
 * difference distinguished known from unknown, defeating the
 * anti-enum. The fix derives the fake userId via HMAC-SHA-256
 * under the server's COOKIE_SECRET, formatted as a RFC-4122
 * compliant UUID v4. Same email → same fake UUID, byte-shape and
 * value-stability indistinguishable from a real `user.id`.
 */
const RECOVER_ENUM_SHIELD_LABEL = 'nodea:recover-enum-shield';

function deriveFakeUserId(email: string, secret: string): string {
  const digest = createHmac('sha256', secret)
    .update(RECOVER_ENUM_SHIELD_LABEL)
    .update('\x1f')
    .update(email)
    .digest('hex');
  // Format as UUID v4 : 8-4-4-4-12 hex with the version nibble
  // forced to 4 (RFC 4122 §4.4) and the variant bits to '10xx'
  // (§4.1.1, encoded as the high two bits of the 17th hex). All
  // bytes derive from the HMAC, so the value is deterministic per
  // (secret, email).
  const variantHex = (
    (parseInt(digest.slice(16, 17), 16) & 0b0011) | 0b1000
  ).toString(16);
  return (
    digest.slice(0, 8) +
    '-' +
    digest.slice(8, 12) +
    '-' +
    '4' +
    digest.slice(13, 16) +
    '-' +
    variantHex +
    digest.slice(17, 20) +
    '-' +
    digest.slice(20, 32)
  );
}

function fakeRecoveryBlobs(email: string, secret: string): FakeBlobs {
  return {
    wrappedKekRecovery: randomBytes(48).toString('base64'),
    wrappedKekRecoveryIv: randomBytes(12).toString('base64'),
    userId: deriveFakeUserId(email, secret),
  };
}

authRecoveryRoutes.openapi(recoverStartRoute, async (c) => {
  await opaqueReady;

  const raw = await c.req.json().catch(() => null);
  const parsed = RecoverKekStartBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const email = body.email.toLowerCase();

  const [user] = await db
    .select({
      id: users.id,
      wrappedKekRecovery: users.wrappedKekRecovery,
      wrappedKekRecoveryIv: users.wrappedKekRecoveryIv,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // OPAQUE: produce the registrationResponse for the new password
  // the client will commit to during /finish. Stateless — just
  // takes the request + userIdentifier + serverSetup. Same shape
  // for known and unknown emails (the lib doesn't care whether the
  // identifier maps to a real account; it produces a deterministic
  // response from the inputs).
  let registrationResponse: string;
  try {
    ({ registrationResponse } = createRegistrationResponse({
      userIdentifier: email,
      registrationRequest: body.registrationRequest,
    }));
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  // Anti-enum: known user with a recovery code → real blobs.
  // Anything else (no user, or user without recovery_code_hash) →
  // fake blobs + a session bound to null. /finish refuses uniformly.
  let blobs: FakeBlobs;
  let userIdForSession: string | null;
  if (
    user &&
    user.wrappedKekRecovery !== null &&
    user.wrappedKekRecoveryIv !== null
  ) {
    blobs = {
      wrappedKekRecovery: user.wrappedKekRecovery,
      wrappedKekRecoveryIv: user.wrappedKekRecoveryIv,
      userId: user.id,
    };
    userIdForSession = user.id;
  } else {
    blobs = fakeRecoveryBlobs(email, getConfig().COOKIE_SECRET);
    userIdForSession = null;
  }

  const recoverSessionId = storeRecoverPending(userIdForSession);
  const response: RecoverKekStartResponse = {
    recoverSessionId,
    wrappedKekRecovery: blobs.wrappedKekRecovery,
    wrappedKekRecoveryIv: blobs.wrappedKekRecoveryIv,
    userId: blobs.userId,
    registrationResponse,
  };
  return c.json(response, 200);
});

/* ============================================================================
 * POST /auth/recover-kek/finish
 * Consume the recover session, validate the hash, rotate everything.
 * ========================================================================== */

authRecoveryRoutes.openapi(recoverFinishRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = RecoverKekFinishBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;

  const pending = consumeRecoverPending(body.recoverSessionId);
  if (!pending) return c.json({ error: 'invalid_credentials' }, 401);
  if (pending.userId === null) {
    // /start went through the anti-enum branch — refuse uniformly.
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, pending.userId))
    .limit(1);
  if (!user || user.recoveryCodeHash === null) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  // Constant-time hash comparison. A mismatch is logged as an
  // **aggregated counter** (no per-user identifier — SEC-06) so the
  // operator sees the rate without being able to correlate hash
  // mismatches to a specific user. If a future investigation needs
  // to trace one specific account, surface the user id via Sentry's
  // event metadata (which already strips PII via beforeSend) rather
  // than into stdout logs.
  if (!constantTimeEqualHex(user.recoveryCodeHash, body.recoveryCodeHash)) {
    console.warn('[auth/recover-kek] hash_mismatch');
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(opaqueRecords)
      .set({
        envelope: body.registrationRecord,
        // The new envelope was registered at /start under the email
        // the user typed — which had to match `users.email` for the
        // real-blobs branch to fire, so the DB value is the same
        // string. Login must replay it after a later change-email.
        userIdentifier: user.email,
      })
      .where(eq(opaqueRecords.userId, user.id));

    // Tier 3 : the old code is consumed, NOT rotated in-place.
    // We null `recoveryCodeHash` + `wrappedKekRecovery{,Iv}` so the
    // typed mnemonic becomes useless, AND the user is dropped in the
    // « no recovery code configured » state — the sidebar tip
    // reappears (driven by `recoveryCodeSet: false` on /auth/me) and
    // they can define a new code at their leisure via /recovery-code.
    // `recoveryAcknowledgedAt` is also reset since the next code
    // setup will set it again.
    await tx
      .update(users)
      .set({
        wrappedKekPassword: body.wrappedKekPassword,
        wrappedKekPasswordIv: body.wrappedKekPasswordIv,
        wrappedKekRecovery: null,
        wrappedKekRecoveryIv: null,
        recoveryCodeHash: null,
        recoveryAcknowledgedAt: null,
        // Code consumed → no phrase to re-verify; clear the anchor so
        // recoveryReverifyDue reads false until a new code is set.
        recoveryVerifiedAt: null,
        recoveryVerifyStreak: 0,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  });

  await revokeAllUserSessions(user.id);
  // Successful recovery proves account control; defang any pending
  // bypass before issuing the new session. The recovery flow just
  // set a fresh password via OPAQUE registration, so the new
  // session is fresh wrt password.
  await cancelPendingBypassesForUser(user.id);
  const session = await createSession(user.id, {
    reauthFresh: { password: true },
  });
  await setSessionCookie(c, session.id, session.expiresAt);

  // Best-effort notification — the recovery just succeeded server-
  // side, an SMTP hiccup must not turn that into a 5xx. The user
  // already has a fresh session in their browser; this is the
  // "if it wasn't you, here's how to react" follow-up.
  try {
    const rendered = renderRecoveryAppliedEmail({ language: extractEmailLanguage(c) });
    await getEmailService().send({
      to: user.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      tag: 'recovery-applied',
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {

      console.warn('[auth/recover-kek] notification mail failed', err);
    }
  }

  return c.json({ ok: true as const }, 200);
});
