/**
 * Recovery-phrase re-verify backoff (Auth-Roadmap Phase 3B, Auth-Spec §7.7).
 *
 * **What.** Pure policy: given when the user last proved they still hold the
 * CURRENT recovery phrase (`recovery_verified_at`) and how many times in a
 * row they've done so (`recovery_verify_streak`), decide whether a fresh
 * re-verification is now due.
 *
 * **Where.** Server-side, because the cadence is the single source of truth —
 * the client only reacts to the `recoveryReverifyDue` boolean on `/auth/me`,
 * it never recomputes the policy (keeps it tamper-resistant + lets us tune the
 * ladder without shipping a web build).
 *
 * **Assumptions.** `now` is injected (no `Date.now()` inside) so the branch is
 * trivially unit-testable. Callers only invoke `computeRecoveryReverifyDue`
 * when a code IS set — a *missing* code is the other banner's job
 * (`recoveryCodeSet === false`), not this one. A code-set row with a NULL
 * anchor is anomalous; we treat it as due so the next re-verify self-heals it.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Re-verify interval per streak level, in weeks. We nag less as trust builds:
 * 6 wk → ~3 mo → ~6 mo → ~1 yr. Months are clean week approximations
 * (13/26/52 wk). Index clamps to the last rung for any higher streak.
 */
const LADDER_WEEKS = [6, 13, 26, 52] as const;

/** Backoff window in ms for a given streak (clamped to the ladder). */
export function recoveryReverifyWindowMs(streak: number): number {
  const i = Math.min(Math.max(streak, 0), LADDER_WEEKS.length - 1);
  return LADDER_WEEKS[i]! * WEEK_MS;
}

/**
 * True when the user should re-verify their recovery phrase now. Call only
 * for users who HAVE a code set; `verifiedAt === null` then means the anchor
 * is missing (anomaly) → due, so the next verify stamps it.
 */
export function computeRecoveryReverifyDue(
  verifiedAt: Date | null,
  streak: number,
  now: Date,
): boolean {
  if (verifiedAt === null) return true;
  return now.getTime() - verifiedAt.getTime() >= recoveryReverifyWindowMs(streak);
}
