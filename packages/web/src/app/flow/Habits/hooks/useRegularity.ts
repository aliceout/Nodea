import { parseLocalDate } from '@/core/i18n/date-format';

import type { HabitItem, HabitLog } from './useHabits';

/**
 * Compute the number of expected occurrences for an habit between two
 * dates, based on its `frequency` and (optional) `target`.
 *
 * - `daily`: target per day (default 1) × days
 * - `weekly`: target per week (default 1) × (days / 7)
 * - `monthly`: target per month (default 1) × (days / 30.44)
 * - `custom`: unknown cadence — we return `null` and the caller shows a
 *   dash rather than a misleading rate.
 */
export function expectedCount(
  item: HabitItem,
  from: Date,
  to: Date,
): number | null {
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const target = Math.max(1, item.payload.target ?? 1);
  switch (item.payload.frequency) {
    case 'daily':
      return target * days;
    case 'weekly':
      return target * (days / 7);
    case 'monthly':
      return target * (days / 30.44);
    case 'custom':
    default:
      return null;
  }
}

/**
 * 0..1 ratio of logged occurrences / expected over a rolling window.
 * Returns `null` when we can't compute expectations (custom frequency
 * or zero-length window).
 */
export function regularityRate(
  item: HabitItem,
  logs: HabitLog[],
  windowDays = 30,
): number | null {
  const now = new Date();
  const from = new Date(now.getTime() - windowDays * 86_400_000);
  const expected = expectedCount(item, from, now);
  if (expected == null || expected === 0) return null;

  // `log.payload.date` is a `YYYY-MM-DD` string ; constructing a
  // `Date` from it via `new Date(iso)` parses as UTC midnight, which
  // drifts by up to 14 h relative to the local-midnight `from` and
  // `now` above. On UTC+10 (Sydney) or UTC-8 (Pacific) the day
  // boundary lands inside a separate calendar day, so a log entered
  // « today » falls outside the window and `regularityRate` reads as
  // « one observation missing ». Switch to `parseLocalDate` which
  // builds the same calendar day at the user's local midnight.
  const count = logs.filter((log) => {
    if (log.payload.itemRid !== item.id) return false;
    const d = parseLocalDate(log.payload.date);
    if (Number.isNaN(d.getTime())) return false;
    return d >= from && d <= now;
  }).length;

  return Math.min(1, count / expected);
}
