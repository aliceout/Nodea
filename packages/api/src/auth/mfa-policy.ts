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
 *
 * Requirement shape — a requirement is either a single mandatory
 * factor (e.g. `'totp'`) or an OR set (e.g. `{ anyOf: ['totp',
 * 'passkey'] }`) where verifying any single alternative satisfies
 * the whole group. The OR shape exists for issue #72 : in mode
 * `always_2fa` password-first, the 2nd factor can now be TOTP OR a
 * passkey. Internally we keep the structure ; the wire format stays
 * a flat `MfaFactor[]` (when an OR is pending, every alternative is
 * surfaced so the client can decide which screen to drive).
 */
import type { Session, User } from '../db/schema.ts';

export type MfaFactor = 'totp' | 'passkey' | 'password';

/**
 * Either a single mandatory factor, or an OR set where verifying any
 * one alternative satisfies the requirement. OR sets are kept
 * non-empty by construction (`requiredFactorsForMode` never returns
 * an empty `anyOf`).
 */
export type FactorRequirement =
  | MfaFactor
  | { readonly anyOf: readonly [MfaFactor, MfaFactor, ...MfaFactor[]] };

/** Factors required by mode after the primary factor (entry chemin)
 *  has succeeded. Auth-Spec §7.4 stepped MFA matrix :
 *
 *    | mode               | password-first      | passkey-first       |
 *    |--------------------|---------------------|---------------------|
 *    | password_or_passkey| —                   | —                   |
 *    | always_2fa         | totp OR passkey     | totp                |
 *    | maximum            | passkey + totp      | password + totp     |
 *
 *  Note (issue #72) : in `always_2fa` password-first, the 2nd factor
 *  is now an OR set — a passkey assertion is accepted in lieu of a
 *  TOTP code. Passkey-first stays TOTP-only ; a 2nd passkey assertion
 *  on the same login would be redundant.
 */
export function requiredFactorsForMode(
  user: Pick<User, 'securityMode'>,
  entryFactor: 'password' | 'passkey',
): readonly FactorRequirement[] {
  switch (user.securityMode) {
    case 'password_or_passkey':
      return [];
    case 'always_2fa':
      return entryFactor === 'password'
        ? [{ anyOf: ['totp', 'passkey'] }]
        : ['totp'];
    case 'maximum':
      return entryFactor === 'password' ? ['passkey', 'totp'] : ['password', 'totp'];
    default:
      // Defensive : an unknown mode (forward-compat with Phase 5D+
      // additions) defaults to "no extras", matching
      // password_or_passkey. Routes that care should also gate on
      // the explicit mode value rather than this fallback.
      return [];
  }
}

/**
 * Filter an OR set down to alternatives the user has actually
 * enrolled. Mandatory single factors are left as-is (the
 * route-level safety net handles the corrupted "mode wants X but
 * nothing enrolled" case). An OR set collapses to a single mandatory
 * factor when exactly one alternative is enrolled, or stays as an OR
 * set with the available subset when several are.
 *
 * Falls back to the original OR set when NO alternative is enrolled
 * — paranoid case ; the route safety net should have already
 * downgraded to a full session, but if a corrupted row ever slips
 * through we'd rather report every alternative than silently drop the
 * requirement.
 */
export function filterRequirementsByEnrollment(
  reqs: readonly FactorRequirement[],
  enrolled: Readonly<Record<MfaFactor, boolean>>,
): readonly FactorRequirement[] {
  const out: FactorRequirement[] = [];
  for (const req of reqs) {
    if (typeof req === 'string') {
      out.push(req);
      continue;
    }
    const available = req.anyOf.filter((f) => enrolled[f]);
    if (available.length === 0) {
      out.push(req);
    } else if (available.length === 1) {
      out.push(available[0]!);
    } else {
      out.push({
        anyOf: available as unknown as readonly [
          MfaFactor,
          MfaFactor,
          ...MfaFactor[],
        ],
      });
    }
  }
  return out;
}

/**
 * Flatten a requirements list to the unique set of factors that
 * appear anywhere in it. Used at the wire boundary : the response
 * shape (`factorsNeeded`, `missing`) stays a flat `MfaFactor[]` so
 * existing clients keep parsing, and the client interprets the list
 * as "any of these still needs to happen" — which matches both
 * AND-style (each appears once) and OR-style (alternatives appear
 * together) semantics for the purposes of « which UI to show ».
 */
export function flattenRequirements(
  reqs: readonly FactorRequirement[],
): readonly MfaFactor[] {
  const out: MfaFactor[] = [];
  const seen = new Set<MfaFactor>();
  for (const req of reqs) {
    if (typeof req === 'string') {
      if (!seen.has(req)) {
        seen.add(req);
        out.push(req);
      }
    } else {
      for (const alt of req.anyOf) {
        if (!seen.has(alt)) {
          seen.add(alt);
          out.push(alt);
        }
      }
    }
  }
  return out;
}

/**
 * Is `factor` ever required as a MANDATORY single factor (not just
 * one alternative inside an OR set) ? Kept around for callers that
 * want the original « specific factor is mandatory » signal.
 */
export function isFactorMandatory(
  reqs: readonly FactorRequirement[],
  factor: MfaFactor,
): boolean {
  return reqs.some((req) => typeof req === 'string' && req === factor);
}

/**
 * Can the user fulfill every requirement with what they have
 * enrolled today ? Used by the primary-login safety net : if mode
 * demands a factor (or one of an OR set) but the user has nothing
 * enrolled that satisfies it, mint a `full` session instead of a
 * `mfa_pending` row the user couldn't finalize. The mode will get
 * downgraded the next time they touch Settings / disable a factor.
 *
 * - Single mandatory factor : satisfied iff the user has it enrolled.
 * - OR set : satisfied iff AT LEAST ONE alternative is enrolled.
 */
export function canSatisfyAll(
  reqs: readonly FactorRequirement[],
  enrolled: Readonly<Record<MfaFactor, boolean>>,
): boolean {
  for (const req of reqs) {
    if (typeof req === 'string') {
      if (!enrolled[req]) return false;
    } else {
      if (!req.anyOf.some((f) => enrolled[f])) return false;
    }
  }
  return true;
}

/**
 * Given a `mfa_pending` session row + the user's mode, list factors
 * still missing. Used by the verify routes + finalize gate.
 *
 * The entry factor is reconstructed from which `mfa_*_verified`
 * flag was set when the pending row was minted : at primary login,
 * exactly one of password / passkey flips to true. We derive the
 * entry chemin from that — both flags being false would mean the
 * session was minted without a primary factor (impossible state) and
 * we'd report "everything missing" defensively.
 *
 * Returns a flat `MfaFactor[]` :
 *   - mandatory single factors appear when still unverified ;
 *   - for an OR set, every alternative appears together when none
 *     is verified yet, and the whole set disappears the moment any
 *     one alternative is verified.
 *   `length === 0` means the policy is fully satisfied — the caller
 *   can promote the session to `full`.
 */
export function missingFactors(
  user: Pick<User, 'securityMode'>,
  session: Pick<
    Session,
    'mfaPasswordVerified' | 'mfaPasskeyVerified' | 'mfaTotpVerified'
  >,
): readonly MfaFactor[] {
  const verified = new Set<MfaFactor>();
  if (session.mfaPasswordVerified) verified.add('password');
  if (session.mfaPasskeyVerified) verified.add('passkey');
  if (session.mfaTotpVerified) verified.add('totp');

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
      : user.securityMode === 'always_2fa'
        ? (['password', 'totp', 'passkey'] as const)
        : (['password'] as const);
  }

  const required = requiredFactorsForMode(user, entryFactor);
  const out: MfaFactor[] = [];
  for (const req of required) {
    if (typeof req === 'string') {
      if (!verified.has(req)) out.push(req);
    } else {
      const satisfied = req.anyOf.some((f) => verified.has(f));
      if (!satisfied) {
        for (const alt of req.anyOf) out.push(alt);
      }
    }
  }
  return out;
}
