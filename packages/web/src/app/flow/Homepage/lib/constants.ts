import type { MoodScore } from '@nodea/shared';

import type { GoalStatusLite } from './types';

/** How many days the home Mood frise spans. Smaller than the Mood
 *  page's 52-week grid by design — Home is a glance. */
export const MOOD_FRISE_DAYS = 14;

/** How many goals the « Goals » home block surfaces at most. */
export const HOME_GOAL_LIMIT = 5;

/**
 * Same colour ramp as the Mood page's `SCORE_FILL` (kept duplicated
 * because the Mood module doesn't export its constants surface).
 * Update both if the tones drift — see
 * `packages/web/src/app/flow/Mood/lib/constants.ts`.
 */
export const MOOD_BLOCK_FILL: Record<MoodScore, string> = {
  '2': 'bg-accent',
  '1': 'bg-accent-soft',
  '0': 'bg-hair',
  '-1': 'bg-low-soft',
  '-2': 'bg-low',
};

/** Tone class for the small status dot next to each goal. The
 *  human-readable status label (hover hint) is resolved at the call
 *  site via i18n (`home.goals.status.<status>`), not stored here. */
export const STATUS_TONE: Record<GoalStatusLite, string> = {
  open: 'border-hair bg-bg',
  wip: 'border-accent bg-accent',
  done: 'border-accent bg-accent',
};

