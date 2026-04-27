/**
 * MFA factor policy (Auth-Roadmap Phase 5C, Auth-Spec §6.1 + §7.4).
 *
 * Pure functions that compute, given a user's `security_mode` and
 * which factors have been verified on a `mfa_pending` session, what
 * still needs to happen before the session can be promoted to `full`.
 *
 * Kept dep-free + DB-free so route handlers can reuse it both at the
 * primary login step (to decide whether to emit `full` or
 * `mfa_pending`) and at every `/auth/mfa/*` step (to decide whether
 * to finalize or report missing factors).
 */
import type { Session, User } from '../db/schema.ts';

export type MfaFactor = 'totp' | 'passkey' | 'password';

/** Factors required by mode after the primary factor (entry chemin)
 *  has succeeded. Auth-Spec §7.4 stepped MFA matrix:
 *
 *    | mode               | password-first      | passkey-first       |
 *    |--------------------|---------------------|---------------------|
 *    | password_or_passkey| —                   | —                   |
 *    | always_totp        | totp                | totp                |
 *    | maximum            | passkey + totp      | password + totp     |
 *
 *  This helper takes the user's mode + the entry path and lists the
 *  additional factors still needed (modulo what's already verified).
 */
export function requiredFactorsForMode(
  user: Pick<User, 'securityMode'>,
  entryFactor: 'password' | 'passkey',
): readonly MfaFactor[] {
  switch (user.securityMode) {
    case 'password_or_passkey':
      return [];
    case 'always_totp':
      return ['totp'];
    case 'maximum':
      return entryFactor === 'password' ? ['passkey', 'totp'] : ['password', 'totp'];
    default:
      // Defensive: an unknown mode (forward-compat with Phase 5D+
      // additions) defaults to "no extras", matching
      // password_or_passkey. Routes that care should also gate on
      // the explicit mode value rather than this fallback.
      return [];
  }
}

/**
 * Given a `mfa_pending` session row + the user's mode, list factors
 * still missing. Used by the verify routes + finalize gate.
 *
 * The entry factor is reconstructed from which `mfa_*_verified`
 * flag was set when the pending row was minted: at primary login,
 * exactly one of password / passkey flips to true. We derive the
 * entry chemin from that — both flags being false would mean the
 * session was minted without a primary factor (impossible state) and
 * we'd report "everything missing" defensively.
 */
export function missingFactors(
  user: Pick<User, 'securityMode'>,
  session: Pick<
    Session,
    'mfaPasswordVerified' | 'mfaPasskeyVerified' | 'mfaTotpVerified'
  >,
): readonly MfaFactor[] {
  const entryFactor: 'password' | 'passkey' | null = session.mfaPasswordVerified
    ? 'password'
    : session.mfaPasskeyVerified
      ? 'passkey'
      : null;

  if (entryFactor === null) {
    // Should never happen — primary login always sets one flag.
    // Surface every potentially-required factor so the client is
    // forced to restart the flow if it ever does.
    return user.securityMode === 'maximum'
      ? (['password', 'passkey', 'totp'] as const)
      : user.securityMode === 'always_totp'
        ? (['password', 'totp'] as const)
        : (['password'] as const);
  }

  const required = requiredFactorsForMode(user, entryFactor);
  return required.filter((f) => {
    if (f === 'totp') return !session.mfaTotpVerified;
    if (f === 'passkey') return !session.mfaPasskeyVerified;
    if (f === 'password') return !session.mfaPasswordVerified;
    return true;
  });
}
