import type { GoalEntry } from './types';

/** Comparator for goals by date, descending. Empty dates sink to
 *  the end (a goal with no date doesn't deserve to dominate the
 *  list). Goals are usually dated `YYYY-MM` (the legacy
 *  DateMonthPicker form) or `YYYY-MM-DD` ; lexicographic compare
 *  works for both — `localeCompare` matches the FR sort the
 *  rest of the app uses. */
export function byDateDesc(a: GoalEntry, b: GoalEntry): number {
  const ad = a.date || '';
  const bd = b.date || '';
  if (ad === bd) return 0;
  if (!ad) return 1;
  if (!bd) return -1;
  return bd.localeCompare(ad);
}
