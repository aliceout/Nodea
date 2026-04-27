import { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import {
  MfaTotpVerifyBodySchema,
  type MfaTotpVerifyResponse,
} from '@nodea/shared';
import { db } from '../db/client.ts';
import { mfaTotp, mfaTotpRecoveryCodes, sessions } from '../db/schema.ts';
import { verifyTotpCode } from '../auth/totp.ts';
import {
  hashBackupCode,
  normaliseBackupCode,
} from '../auth/totp-backup-codes.ts';
import { finalizeMfaSession } from '../auth/session.ts';
import { setSessionCookie } from '../auth/cookies.ts';
import { missingFactors } from '../auth/mfa-policy.ts';
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
export const authMfaRoutes = new Hono<{ Variables: MfaPendingVariables }>();

const verifyLimiter = rateLimit({
  max: 10,
  windowMs: 5 * 60_000,
  keyPrefix: 'mfa-totp-verify',
});

/* ============================================================================
 * POST /auth/mfa/totp/verify
 * ========================================================================== */

authMfaRoutes.post('/mfa/totp/verify', requireMfaPending, verifyLimiter, async (c) => {
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
    const fullSession = await finalizeMfaSession(sessionId);
    await setSessionCookie(c, fullSession.id, fullSession.expiresAt);
    const response: MfaTotpVerifyResponse = { finalized: true };
    return c.json(response);
  }

  const response: MfaTotpVerifyResponse = {
    finalized: false,
    missing: missing as ('totp' | 'passkey' | 'password')[],
  };
  return c.json(response);
});
