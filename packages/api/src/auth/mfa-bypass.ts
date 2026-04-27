/**
 * MFA bypass helpers (Auth-Roadmap Phase 6, Auth-Spec §7.8 + §6.2).
 *
 * Centralises:
 *   - token generation (32 random bytes base64url, SHA-256 hashed
 *     for storage; same shape as invites + reset tokens);
 *   - eligibility check (the §6.2 "perdu 2 trucs = niqué" rule);
 *   - lazy application at login time (consume a confirmed bypass
 *     past its 48h delay → disable TOTP / delete passkeys, downgrade
 *     mode if needed).
 *
 * Routes import from here so the policy lives in one place rather
 * than scattered across `auth-mfa-bypass.ts` + `auth.ts` +
 * `auth-passkey.ts`.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from '../db/client.ts';
import {
  authFactors,
  mfaBypassRequests,
  mfaTotp,
  mfaTotpRecoveryCodes,
  sessions,
  users,
  type Session,
  type User,
} from '../db/schema.ts';

/**
 * Time the user must wait between confirming the email link and the
 * bypass becoming applicable at login. Auth-Spec §7.8: 48h "real
 * delay" — short enough to be useful, long enough to give the
 * legitimate user time to spot a malicious request.
 */
export const BYPASS_APPLY_DELAY_MS = 48 * 60 * 60 * 1000;

/**
 * TTL of the request record itself. The 48h delay only starts once
 * `confirmed_at` is set; the request as a whole expires after this
 * window so a never-confirmed link doesn't sit forever in the DB.
 */
export const BYPASS_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/* ============================================================================
 * Token gen + hashing
 * ========================================================================== */

export interface BypassTokenPair {
  /** Plaintext token to embed in the email link — 32 bytes
   *  base64url, ~43 chars. */
  token: string;
  /** SHA-256 hex of the plaintext. Stored in DB. */
  hash: string;
}

export function newBypassToken(): BypassTokenPair {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token, 'utf-8').digest('hex');
  return { token, hash };
}

export function hashBypassToken(token: string): string {
  return createHash('sha256').update(token, 'utf-8').digest('hex');
}

/**
 * Constant-time hex comparison — defence in depth. The DB lookup
 * (`WHERE confirm_token_hash = $1`) already runs in O(1), but we
 * keep the constant-time check on the rare path where the caller
 * compares two hashes by hand.
 */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  if (!/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b)) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/* ============================================================================
 * Eligibility — Auth-Spec §6.2 "perdu 2 trucs = niqué"
 * ========================================================================== */

/**
 * Decide whether the caller can request a bypass for `factor` given
 * the current `mfa_pending` session and the user's mode.
 *
 * Auth-Spec §7.8 table:
 *
 *   | Mode               | totp bypass OK if                | passkey bypass OK if            |
 *   |--------------------|----------------------------------|---------------------------------|
 *   | password_or_passkey| N/A (TOTP not required)          | N/A (passkey alt to password)   |
 *   | always_totp        | password OR passkey verified     | N/A                             |
 *   | maximum            | password AND passkey verified    | password AND TOTP verified      |
 *
 * Returns:
 *   - 'eligible' — caller can proceed.
 *   - 'not_required' — the factor isn't required by the current
 *     mode; bypass is moot. UI shouldn't surface the option.
 *   - 'multi_factor_loss' — the §6.2 wall: more than one required
 *     factor would need bypassing; caller must reset destructive.
 */
export function bypassEligibility(
  user: Pick<User, 'securityMode'>,
  session: Pick<
    Session,
    'mfaPasswordVerified' | 'mfaPasskeyVerified' | 'mfaTotpVerified'
  >,
  factor: 'totp' | 'passkey',
): 'eligible' | 'not_required' | 'multi_factor_loss' {
  if (user.securityMode === 'password_or_passkey') {
    return 'not_required';
  }
  if (factor === 'totp') {
    if (user.securityMode === 'always_totp') {
      // Either chemin (password OR passkey) suffices since TOTP is
      // the only MFA factor in this mode.
      return session.mfaPasswordVerified || session.mfaPasskeyVerified
        ? 'eligible'
        : 'multi_factor_loss';
    }
    // mode === 'maximum'
    return session.mfaPasswordVerified && session.mfaPasskeyVerified
      ? 'eligible'
      : 'multi_factor_loss';
  }
  // factor === 'passkey'
  if (user.securityMode === 'always_totp') {
    // Mode `always_totp` doesn't require passkey at all.
    return 'not_required';
  }
  // mode === 'maximum'
  return session.mfaPasswordVerified && session.mfaTotpVerified
    ? 'eligible'
    : 'multi_factor_loss';
}

/* ============================================================================
 * Lazy application — consume a confirmed bypass past its delay
 * ========================================================================== */

export interface BypassApplyResult {
  factor: 'totp' | 'passkey';
  /** True when `security_mode` was downgraded as a side-effect.
   *  The notification email mentions this so the user knows the
   *  mode flipped. */
  downgraded: boolean;
}

/**
 * Look for a consumable bypass for this user and apply it
 * atomically. Returns the applied factor + downgrade flag, or
 * `null` if no bypass is consumable right now.
 *
 * Side effects per factor:
 *   - `totp` → `mfa_totp.enabled_at = NULL`, DELETE backup codes.
 *     Mode `always_totp` / `maximum` → downgrade to
 *     `password_or_passkey`.
 *   - `passkey` → DELETE all `auth_factors` of kind `passkey`. Mode
 *     `maximum` → downgrade to `password_or_passkey`.
 *
 * Marks the request `consumed_at` and revokes every other session
 * of the user (per §7.8 "revoke toutes les autres sessions"). The
 * caller (login route) gets a fresh session minted afterwards.
 */
export async function applyConsumableBypass(
  user: Pick<User, 'id' | 'securityMode'>,
  factor: 'totp' | 'passkey',
  currentSessionId: string | null,
): Promise<BypassApplyResult | null> {
  const now = new Date();
  const delayCutoff = new Date(now.getTime() - BYPASS_APPLY_DELAY_MS);

  // Find a confirmed-past-delay non-cancelled non-consumed
  // non-expired request matching the factor.
  const [request] = await db
    .select()
    .from(mfaBypassRequests)
    .where(
      and(
        eq(mfaBypassRequests.userId, user.id),
        eq(mfaBypassRequests.factor, factor),
        isNull(mfaBypassRequests.cancelledAt),
        isNull(mfaBypassRequests.consumedAt),
      ),
    )
    .limit(1);
  if (!request) return null;
  if (request.confirmedAt === null) return null;
  if (request.confirmedAt > delayCutoff) return null;
  if (request.expiresAt < now) return null;

  let downgraded = false;
  await db.transaction(async (tx) => {
    if (factor === 'totp') {
      await tx
        .update(mfaTotp)
        .set({ enabledAt: null, lastWindow: null })
        .where(eq(mfaTotp.userId, user.id));
      await tx
        .delete(mfaTotpRecoveryCodes)
        .where(eq(mfaTotpRecoveryCodes.userId, user.id));
      if (
        user.securityMode === 'always_totp' ||
        user.securityMode === 'maximum'
      ) {
        await tx
          .update(users)
          .set({ securityMode: 'password_or_passkey', updatedAt: now })
          .where(eq(users.id, user.id));
        downgraded = true;
      }
    } else {
      await tx
        .delete(authFactors)
        .where(
          and(
            eq(authFactors.userId, user.id),
            eq(authFactors.kind, 'passkey'),
          ),
        );
      if (user.securityMode === 'maximum') {
        await tx
          .update(users)
          .set({ securityMode: 'password_or_passkey', updatedAt: now })
          .where(eq(users.id, user.id));
        downgraded = true;
      }
    }

    await tx
      .update(mfaBypassRequests)
      .set({ consumedAt: now })
      .where(eq(mfaBypassRequests.id, request.id));

    // Revoke every other session of the user — Auth-Spec §7.8.
    // The current pending session (if any) is excluded so the
    // caller can promote it to full afterwards. If the caller
    // doesn't pass a current session id, every session goes.
    if (currentSessionId === null) {
      await tx.delete(sessions).where(eq(sessions.userId, user.id));
    } else {
      // No `ne()` import locally — emulate via a NOT-equal subquery.
      // Drizzle exposes `ne` from drizzle-orm; pulling it here.
      const { ne } = await import('drizzle-orm');
      await tx
        .delete(sessions)
        .where(
          and(
            eq(sessions.userId, user.id),
            ne(sessions.id, currentSessionId),
          ),
        );
    }
  });

  return { factor, downgraded };
}

/* ============================================================================
 * Auto-cancel on successful login
 * ========================================================================== */

/**
 * Cancel every pending bypass request for `userId`. Called right
 * after a successful full-session promotion — completing a normal
 * login proves the user still controls the factor they claimed to
 * have lost, so the request is moot. It also defangs an attacker-
 * triggered bypass: as soon as the legit user logs in, any in-flight
 * request is invalidated.
 *
 * "Pending" here means not yet `consumed_at` and not yet
 * `cancelled_at`. A confirmed-but-too-recent request is still
 * pending (the 48h hasn't elapsed) and gets cancelled the same way.
 *
 * Returns the number of rows flipped — used by callers that want to
 * log the side-effect (or skip a follow-up email when nothing
 * changed).
 */
export async function cancelPendingBypassesForUser(
  userId: string,
): Promise<number> {
  const rows = await db
    .update(mfaBypassRequests)
    .set({ cancelledAt: new Date() })
    .where(
      and(
        eq(mfaBypassRequests.userId, userId),
        isNull(mfaBypassRequests.cancelledAt),
        isNull(mfaBypassRequests.consumedAt),
      ),
    )
    .returning({ id: mfaBypassRequests.id });
  return rows.length;
}
