import type { MoodScore } from '@nodea/shared';

import type { GoalStatus } from './constants';

/** Type guard for the canonical Mood score strings. Used to
 *  narrow free-form inputs (e.g. a `<select>`'s `value`) before
 *  passing them to the encrypted record. */
export function isMoodScoreString(s: string | undefined): s is MoodScore {
  return s === '-2' || s === '-1' || s === '0' || s === '1' || s === '2';
}

/** Type guard for the **canonical** three-state goal status as
 *  the picker exposes it. The legacy `active` / `archived`
 *  values are tolerated server-side on read but never produced
 *  by the Composer, so this guard rejects them. */
export function isCanonicalGoalStatus(s: string | undefined): s is GoalStatus {
  return s === 'open' || s === 'wip' || s === 'done';
}
