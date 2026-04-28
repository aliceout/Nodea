import { Hono } from 'hono';
import { eq, isNotNull } from 'drizzle-orm';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  RecoverKekFinishBodySchema,
  RecoverKekStartBodySchema,
  RecoveryCodeUpsertBodySchema,
  type RecoverKekStartResponse,
} from '@nodea/shared';
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
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';

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
export const authRecoveryRoutes = new Hono<{ Variables: AuthVariables }>();

const recoverLimiter = rateLimit({
  max: 5,
  windowMs: 60 * 60_000,
  keyPrefix: 'recover-kek',
});

const recoverySetupLimiter = rateLimit({
  max: 5,
  windowMs: 60 * 60_000,
  keyPrefix: 'recovery-code-setup',
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

authRecoveryRoutes.post(
  '/security/recovery-code',
  requireUser,
  requireFreshPassword,
  recoverySetupLimiter,
  async (c) => {
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
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return c.json({ ok: true, regenerated: isRegenerate });
  },
);

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
 */
function fakeRecoveryBlobs(): FakeBlobs {
  return {
    wrappedKekRecovery: randomBytes(48).toString('base64'),
    wrappedKekRecoveryIv: randomBytes(12).toString('base64'),
    userId: randomUUID(),
  };
}

authRecoveryRoutes.post('/recover-kek/start', recoverLimiter, async (c) => {
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
    blobs = fakeRecoveryBlobs();
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
  return c.json(response);
});

/* ============================================================================
 * POST /auth/recover-kek/finish
 * Consume the recover session, validate the hash, rotate everything.
 * ========================================================================== */

authRecoveryRoutes.post('/recover-kek/finish', recoverLimiter, async (c) => {
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

  // Constant-time hash comparison. A mismatch is treated as a
  // wrong recovery code — server logs it for monitoring but no
  // mutation is applied.
  if (!constantTimeEqualHex(user.recoveryCodeHash, body.recoveryCodeHash)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[auth/recover-kek] hash_mismatch for user ${user.id} (${user.email})`,
    );
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(opaqueRecords)
      .set({ envelope: body.registrationRecord })
      .where(eq(opaqueRecords.userId, user.id));

    await tx
      .update(users)
      .set({
        wrappedKekPassword: body.wrappedKekPassword,
        wrappedKekPasswordIv: body.wrappedKekPasswordIv,
        wrappedKekRecovery: body.wrappedKekRecoveryNew,
        wrappedKekRecoveryIv: body.wrappedKekRecoveryNewIv,
        recoveryCodeHash: body.recoveryCodeHashNew,
        recoveryAcknowledgedAt: new Date(),
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

  // TODO Phase 6 / mailer follow-up : send a notification email
  // ("Ton mot de passe a été réinitialisé via recovery code…").
  // The mail template doesn't exist yet — wired in once the
  // template lands.

  return c.json({ ok: true });
});

// `isNotNull` is imported for upcoming queries; reference it once
// to keep eslint quiet until we wire the related route.
void isNotNull;
