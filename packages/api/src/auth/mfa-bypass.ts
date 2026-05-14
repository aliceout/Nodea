/**
 * MFA bypass helpers (Auth-Roadmap Phase 6, Auth-Spec §7.8 + §6.2).
 *
 * Centralises:
 *   - token generation (32 random bytes base64url, SHA-256 hashed
 *     for storage; same shape as invites + reset tokens);
 *   - eligibility check (the §6.2 "perdu 2 trucs = niqué" rule);
 *   - lazy application at login time (consume a confirmed bypass
 *     past its 7-day delay → disable TOTP / delete passkeys,
 *     downgrade mode if needed).
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
 * bypass becoming applicable at login. Auth-Spec §7.8: 7-day "real
 * delay" — backup codes already provide a fast bypass path, so the
 * email recovery is the slow / deliberate one. The long window also
 * gives the legit user plenty of time to spot a malicious request
 * and click the cancel link.
 */
export const BYPASS_APPLY_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * TTL of the request record itself. The apply delay only starts
 * once `confirmed_at` is set; the request as a whole expires after
 * this window so a never-confirmed link doesn't sit forever in the
 * DB. Must be > apply delay so a user who confirms near the end of
 * the confirmation window still has time for the delay to elapse —
 * we give 7 days to confirm + 7 days of delay = 14 days total.
 */
export const BYPASS_REQUEST_TTL_MS = 14 * 24 * 60 * 60 * 1000;

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
 * the current `mfa_pending` session, the user's mode, and which
 * factors they actually have enrolled.
 *
 * Auth-Spec §7.8 table (after issue #72 — always_2fa accepts either
 * TOTP or passkey as the 2nd factor, so both can be the sole MFA
 * carrier in that mode):
 *
 *   | Mode                | factor=totp                                    | factor=passkey                                  |
 *   |---------------------|------------------------------------------------|-------------------------------------------------|
 *   | password_or_passkey | N/A                                            | N/A (passkey alt to password)                   |
 *   | always_2fa          | hasTotp ? (password OR passkey verified)       | hasPasskey ? (password OR TOTP verified)        |
 *   |                     |          : not_required                        |             : not_required                      |
 *   | maximum             | password AND passkey verified                  | password AND TOTP verified                      |
 *
 * `factors.hasTotp` / `factors.hasPasskey` reflect the user's actual
 * enrollment — bypass for a factor the user doesn't have is moot.
 *
 * Returns:
 *   - 'eligible' — caller can proceed.
 *   - 'not_required' — the factor isn't required by the current
 *     mode (or not enrolled); bypass is moot. UI shouldn't surface
 *     the option.
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
  factors: { hasTotp: boolean; hasPasskey: boolean },
): 'eligible' | 'not_required' | 'multi_factor_loss' {
  if (user.securityMode === 'password_or_passkey') {
    return 'not_required';
  }
  if (factor === 'totp') {
    if (!factors.hasTotp) return 'not_required';
    if (user.securityMode === 'always_2fa') {
      // TOTP is one of two acceptable 2nd factors. Bypassing it
      // requires the alternate path (password or passkey).
      return session.mfaPasswordVerified || session.mfaPasskeyVerified
        ? 'eligible'
        : 'multi_factor_loss';
    }
    // mode === 'maximum' (TOTP is mandatory)
    return session.mfaPasswordVerified && session.mfaPasskeyVerified
      ? 'eligible'
      : 'multi_factor_loss';
  }
  // factor === 'passkey'
  if (!factors.hasPasskey) return 'not_required';
  if (user.securityMode === 'always_2fa') {
    // Passkey is one of two acceptable 2nd factors (issue #72).
    // Bypassing it requires the alternate path (password or TOTP).
    return session.mfaPasswordVerified || session.mfaTotpVerified
      ? 'eligible'
      : 'multi_factor_loss';
  }
  // mode === 'maximum' (passkey is mandatory)
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
 * Side effects per factor (mode-downgrade rules match the manual
 * de-enrollment routes — `auth-totp.disable` / `auth-passkey-manage.remove`;
 * the row-level write differs: TOTP is *disabled* here (`enabled_at = NULL`)
 * to keep the secret around for potential re-enrolment via the email
 * link, while the manual disable route DELETEs the row outright):
 *   - `totp` → `mfa_totp.enabled_at = NULL`, DELETE backup codes.
 *     Mode `maximum` → always downgrade to `password_or_passkey`
 *     (maximum strictly requires TOTP). Mode `always_2fa` →
 *     downgrade only if no passkey remains as 2nd factor (since
 *     #72, a passkey alone keeps `always_2fa` alive).
 *   - `passkey` → DELETE all `auth_factors` of kind `passkey`.
 *     Mode `maximum` → always downgrade. Mode `always_2fa` →
 *     downgrade only if no TOTP is enabled.
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
      // §6.1 downgrade auto — see route counterpart in
      // `auth-totp.ts /disable`. `maximum` always falls; `always_2fa`
      // only falls when no passkey is left to carry the 2nd factor.
      let shouldDowngrade = false;
      if (user.securityMode === 'maximum') {
        shouldDowngrade = true;
      } else if (user.securityMode === 'always_2fa') {
        const [anyPasskey] = await tx
          .select({ id: authFactors.id })
          .from(authFactors)
          .where(
            and(
              eq(authFactors.userId, user.id),
              eq(authFactors.kind, 'passkey'),
            ),
          )
          .limit(1);
        shouldDowngrade = !anyPasskey;
      }
      if (shouldDowngrade) {
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
      // §6.1 downgrade auto — see route counterpart in
      // `auth-passkey-manage.ts /:id/remove`. `maximum` always
      // falls; `always_2fa` only falls when no TOTP is left.
      let shouldDowngrade = false;
      if (user.securityMode === 'maximum') {
        shouldDowngrade = true;
      } else if (user.securityMode === 'always_2fa') {
        const [totpRow] = await tx
          .select({ enabledAt: mfaTotp.enabledAt })
          .from(mfaTotp)
          .where(eq(mfaTotp.userId, user.id))
          .limit(1);
        const hasTotp = !!totpRow && totpRow.enabledAt !== null;
        shouldDowngrade = !hasTotp;
      }
      if (shouldDowngrade) {
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
 * pending (the apply delay hasn't elapsed) and gets cancelled the same way.
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
