/**
 * Stepped-MFA verification routes: `POST /auth/mfa/totp/verify`,
 * `POST /auth/mfa/passkey/start` + `/finish`.
 *
 * Where: api auth route layer (mounted at `/auth`), reached only with an
 * `mfa_pending` session (requireMfaPending) between primary auth and the
 * second factor.
 *
 * Non-obvious: the last successful factor finalizes the session INLINE
 * (there is no `/auth/mfa/finalize` route) — it returns
 * `{ finalized: true }` (or `{ finalized: false, missing }`) and swaps
 * the cookie to `full`. TOTP `verify` also accepts a backup code in the
 * same `code` field (format-disambiguated). UV failure collapses to 401
 * `invalid_credentials`. Keyed-session rate limit (10/5min).
 */
import { and, eq, isNull } from 'drizzle-orm';
import {
  MfaPasskeyFinishBodySchema,
  MfaPasskeyFinishResponseSchema,
  MfaPasskeyStartBodySchema,
  MfaPasskeyStartResponseSchema,
  MfaTotpVerifyBodySchema,
  MfaTotpVerifyResponseSchema,
  type MfaPasskeyFinishResponse,
  type MfaPasskeyStartResponse,
  type MfaTotpVerifyResponse,
} from '@nodea/shared';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { OpenAPIHono } from '@hono/zod-openapi';
import { defaultInvalidBodyHook, createRoute, errorContent, jsonContent  } from '../openapi/index.ts';
import { db } from '../db/client.ts';
import {
  authFactors,
  mfaTotp,
  mfaTotpRecoveryCodes,
  sessions,
} from '../db/schema.ts';
import { verifyTotpCode } from '../auth/totp.ts';
import {
  hashBackupCode,
  normaliseBackupCode,
} from '../auth/totp-backup-codes.ts';
import { finalizeMfaSession } from '../auth/session.ts';
import { setSessionCookie } from '../auth/cookies.ts';
import { missingFactors } from '../auth/mfa-policy.ts';
import { cancelPendingBypassesForUser } from '../auth/mfa-bypass.ts';
import { getConfig } from '../config.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import {
  requireMfaPending,
  type MfaPendingVariables,
} from '../middleware/require-mfa-pending.ts';


/**
 * Stepped MFA routes (Auth-Roadmap Phase 5C, Auth-Spec §7.4).
 *
 * One route currently:
 *
 *   - `POST /auth/mfa/totp/verify` (mfa_pending) — accepts a 6-digit
 *     TOTP code OR a 24-char backup code in the same `code` field.
 *     Verifies, sets `mfa_totp_verified=true` on the pending row,
 *     and if the row now satisfies `users.security_mode`, promotes
 *     to a full session in the same transaction.
 *
 * Phase 5D adds the passkey-as-second-factor route for mode
 * `maximum`. The `missing` array in this route's response tells the
 * client whether to drive that next or stop.
 *
 * Backup codes are single-use (Auth-Spec §8.3): each consumed code
 * flips `used_at` and the row stays for audit.
 */
export const authMfaRoutes = new OpenAPIHono<{ Variables: MfaPendingVariables }>({
  defaultHook: defaultInvalidBodyHook,
});

// Keyed on the pending session's USER (set by `requireMfaPending`,
// which runs before this limiter), not the caller's IP — an
// attacker holding a stolen password + the `mfa_pending` cookie
// could otherwise multiply TOTP guesses by rotating IPs (audit
// 2026-06). IP stays the fallback if the variable is ever absent.
const verifyLimiter = rateLimit({
  max: 10,
  windowMs: 5 * 60_000,
  keyPrefix: 'mfa-totp-verify',
  keyFn: (c) => {
    const user = c.get('user') as { id?: string } | undefined;
    return user?.id ?? null;
  },
});

const passkeyMfaLimiter = rateLimit({
  max: 10,
  windowMs: 5 * 60_000,
  keyPrefix: 'mfa-passkey',
});

const totpVerifyRoute = createRoute({
  method: 'post',
  path: '/mfa/totp/verify',
  tags: ['auth-mfa'],
  summary: 'Verify TOTP / backup code on a `mfa_pending` session',
  middleware: [requireMfaPending, verifyLimiter] as const,
  request: {
    body: {
      content: { 'application/json': { schema: MfaTotpVerifyBodySchema } },
    },
  },
  responses: {
    200: jsonContent(MfaTotpVerifyResponseSchema, 'Finalized or missing factors'),
    400: errorContent('Invalid body or TOTP not enabled'),
    401: errorContent('Invalid code or pending session'),
    429: errorContent('Rate limit exceeded'),
  },
});

const passkeyStartRoute = createRoute({
  method: 'post',
  path: '/mfa/passkey/start',
  tags: ['auth-mfa'],
  summary: 'Start passkey-as-second-factor on a `mfa_pending` session',
  middleware: [requireMfaPending, passkeyMfaLimiter] as const,
  request: {
    body: {
      content: { 'application/json': { schema: MfaPasskeyStartBodySchema } },
    },
  },
  responses: {
    200: jsonContent(MfaPasskeyStartResponseSchema, 'WebAuthn requestOptions'),
    400: errorContent('Invalid body'),
    401: errorContent('Pending session missing or expired'),
    429: errorContent('Rate limit exceeded'),
  },
});

const passkeyFinishRoute = createRoute({
  method: 'post',
  path: '/mfa/passkey/finish',
  tags: ['auth-mfa'],
  summary: 'Finish passkey-as-second-factor on a `mfa_pending` session',
  middleware: [requireMfaPending, passkeyMfaLimiter] as const,
  request: {
    body: {
      content: { 'application/json': { schema: MfaPasskeyFinishBodySchema } },
    },
  },
  responses: {
    200: jsonContent(MfaPasskeyFinishResponseSchema, 'Finalized or missing factors'),
    400: errorContent('Invalid body, no pending challenge, or expired'),
    401: errorContent('Invalid credentials'),
    429: errorContent('Rate limit exceeded'),
  },
});

/* ============================================================================
 * POST /auth/mfa/totp/verify
 * ========================================================================== */

authMfaRoutes.openapi(totpVerifyRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = MfaTotpVerifyBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const { code } = parsed.data;
  const user = c.get('user');
  const sessionId = c.get('sessionId');
  const pendingSession = c.get('pendingSession');

  // Bail early if TOTP isn't actually enabled for this user — should
  // never happen because the primary-login route only emits
  // mfa_pending when the user's mode requires it, but defence in
  // depth: the row could have been disabled in a separate session
  // between login and the verify call.
  const [totp] = await db
    .select()
    .from(mfaTotp)
    .where(eq(mfaTotp.userId, user.id))
    .limit(1);
  if (!totp || totp.enabledAt === null) {
    return c.json({ error: 'totp_not_enabled' }, 400);
  }

  // Try TOTP first. The 6-digit format is unambiguous; if it doesn't
  // match the regex we fall through to the backup-code path.
  if (/^\d{6}$/.test(code)) {
    const result = await verifyTotpCode(totp.secret, code);
    if (!result.valid) {
      return c.json({ error: 'invalid_code' }, 401);
    }
    // Anti-replay (Auth-Spec §8.3): refuse if the matched window is
    // not strictly after the stored `last_window`.
    if (totp.lastWindow !== null && result.window <= totp.lastWindow) {
      return c.json({ error: 'invalid_code' }, 401);
    }
    await db
      .update(mfaTotp)
      .set({ lastWindow: result.window })
      .where(eq(mfaTotp.userId, user.id));
  } else {
    // Backup-code path. Normalise (strip hyphens, uppercase) before
    // hashing — `normaliseBackupCode` returns null for malformed
    // input.
    const normalised = normaliseBackupCode(code);
    if (normalised === null) {
      return c.json({ error: 'invalid_code' }, 401);
    }
    const hash = hashBackupCode(normalised);

    // Single-use match: codeHash matches AND used_at IS NULL. We do
    // the consume in one UPDATE … WHERE used_at IS NULL so a
    // concurrent racer can't double-spend the same code.
    const result = await db
      .update(mfaTotpRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(mfaTotpRecoveryCodes.userId, user.id),
          eq(mfaTotpRecoveryCodes.codeHash, hash),
          isNull(mfaTotpRecoveryCodes.usedAt),
        ),
      )
      .returning({ id: mfaTotpRecoveryCodes.id });
    if (result.length === 0) {
      return c.json({ error: 'invalid_code' }, 401);
    }
  }

  // Mark TOTP verified on the pending row.
  await db
    .update(sessions)
    .set({ mfaTotpVerified: true })
    .where(eq(sessions.id, sessionId));

  // Recompute missing factors with the freshly-verified flag.
  const updatedPending = {
    ...pendingSession,
    mfaTotpVerified: true,
  };
  const missing = missingFactors(user, updatedPending);

  if (missing.length === 0) {
    // Promote the session — DELETE pending + INSERT full atomically.
    // Successfully verifying every required factor invalidates any
    // bypass request the user (or an attacker) had pending for them.
    await cancelPendingBypassesForUser(user.id);
    const fullSession = await finalizeMfaSession(sessionId);
    await setSessionCookie(c, fullSession.id, fullSession.expiresAt);
    const response: MfaTotpVerifyResponse = { finalized: true };
    return c.json(response, 200);
  }

  const response: MfaTotpVerifyResponse = {
    finalized: false,
    missing: missing as ('totp' | 'passkey' | 'password')[],
  };
  return c.json(response, 200);
});

/* ============================================================================
 * POST /auth/mfa/passkey/start  — passkey-as-second-factor (mode max)
 * ========================================================================== */

authMfaRoutes.openapi(passkeyStartRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = MfaPasskeyStartBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');
  const sessionId = c.get('sessionId');
  const config = getConfig();

  // Build allowCredentials from the user's enrolled passkeys —
  // unlike the public /auth/passkeys/login/start, here the user is
  // already known (we authenticated them on the primary factor)
  // so anti-enum doesn't apply.
  const rows = await db
    .select({
      credentialId: authFactors.credentialId,
      transports: authFactors.transports,
    })
    .from(authFactors)
    .where(eq(authFactors.userId, user.id));

  const allowCredentials = rows.map((row) => {
    const transports = parseTransports(row.transports);
    return transports !== undefined
      ? { id: row.credentialId, transports }
      : { id: row.credentialId };
  });

  const requestOptions = await generateAuthenticationOptions({
    rpID: config.WEBAUTHN_RP_ID,
    userVerification: 'required',
    allowCredentials,
  });

  // Persist the challenge on the pending row so /finish can verify
  // it. Reusing the existing `pending_webauthn_challenge` column.
  await db
    .update(sessions)
    .set({
      pendingWebauthnChallenge: requestOptions.challenge,
      pendingWebauthnChallengeAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));

  const response: MfaPasskeyStartResponse = {
    requestOptions: requestOptions as unknown as Record<string, unknown>,
  };
  return c.json(response, 200);
});

/* ============================================================================
 * POST /auth/mfa/passkey/finish — verify assertion + maybe finalize
 * ========================================================================== */

authMfaRoutes.openapi(passkeyFinishRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = MfaPasskeyFinishBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');
  const sessionId = c.get('sessionId');
  const pendingSession = c.get('pendingSession');

  if (
    !pendingSession.pendingWebauthnChallenge ||
    !pendingSession.pendingWebauthnChallengeAt
  ) {
    return c.json({ error: 'no_pending_challenge' }, 400);
  }
  // 5-minute TTL on the challenge (Auth-Spec §9.2 reuse).
  if (
    Date.now() - pendingSession.pendingWebauthnChallengeAt.getTime() >
    5 * 60_000
  ) {
    return c.json({ error: 'challenge_expired' }, 400);
  }

  const assertion = parsed.data.assertionResponse as unknown as AuthenticationResponseJSON;
  const assertionId = assertion.id;
  if (typeof assertionId !== 'string' || assertionId.length === 0) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  // Cred must belong to THIS user — reject any assertion from a
  // foreign credential even if its signature would otherwise pass.
  const [factor] = await db
    .select()
    .from(authFactors)
    .where(eq(authFactors.credentialId, assertionId))
    .limit(1);
  if (!factor || factor.userId !== user.id) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  const config = getConfig();
  const transports = parseTransports(factor.transports);
  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: pendingSession.pendingWebauthnChallenge,
      expectedOrigin: config.WEBAUTHN_ORIGIN,
      expectedRPID: config.WEBAUTHN_RP_ID,
      requireUserVerification: true,
      credential: {
        id: factor.credentialId,
        publicKey: base64UrlToBytes(factor.publicKey),
        counter: factor.signCount,
        ...(transports !== undefined ? { transports } : {}),
      },
    });
  } catch {
    return c.json({ error: 'invalid_credentials' }, 401);
  }
  if (!verification.verified || !verification.authenticationInfo.userVerified) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  // Sign-counter handling — same logic as the primary login flow
  // (Auth-Spec §9.6).
  const newCounter = verification.authenticationInfo.newCounter;
  if (factor.signCountStrict) {
    if (newCounter > 0 && newCounter <= factor.signCount) {
      return c.json({ error: 'invalid_credentials' }, 401);
    }
  }
  const nextStrict =
    factor.signCountStrict && newCounter === 0 && factor.signCount === 0
      ? false
      : factor.signCountStrict;
  await db
    .update(authFactors)
    .set({
      signCount: newCounter,
      signCountStrict: nextStrict,
      lastUsedAt: new Date(),
    })
    .where(eq(authFactors.id, factor.id));

  // Mark passkey verified on the pending row + clear the
  // single-use challenge.
  await db
    .update(sessions)
    .set({
      mfaPasskeyVerified: true,
      pendingWebauthnChallenge: null,
      pendingWebauthnChallengeAt: null,
    })
    .where(eq(sessions.id, sessionId));

  const updatedPending = { ...pendingSession, mfaPasskeyVerified: true };
  const missing = missingFactors(user, updatedPending);

  if (missing.length === 0) {
    await cancelPendingBypassesForUser(user.id);
    const fullSession = await finalizeMfaSession(sessionId);
    await setSessionCookie(c, fullSession.id, fullSession.expiresAt);
    const response: MfaPasskeyFinishResponse = { finalized: true };
    return c.json(response, 200);
  }

  const response: MfaPasskeyFinishResponse = {
    finalized: false,
    missing: missing as ('totp' | 'passkey' | 'password')[],
  };
  return c.json(response, 200);
});

/* ============================================================================
 * Local helpers
 * ========================================================================== */

function parseTransports(
  csv: string | null,
): AuthenticatorTransportFuture[] | undefined {
  if (!csv) return undefined;
  const parts = csv.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) return undefined;
  return parts as AuthenticatorTransportFuture[];
}

function base64UrlToBytes(value: string) {
  const src = Buffer.from(value, 'base64url');
  const buf = new ArrayBuffer(src.byteLength);
  const out = new Uint8Array(buf);
  out.set(src);
  return out;
}
