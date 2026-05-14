/** Default number of weeks the heatmap spans — kept here so
 *  `rangeFor` can use it without importing from `heatmap.ts`
 *  (avoids a circular dep between date-format ↔ heatmap). */
const DEFAULT_HEATMAP_WEEKS = 52;
const HEATMAP_DAYS_PER_WEEK = 7;

/**
 * Date range covered by a year selection.
 *
 * Three values :
 * - `start` / `end` — visible window. Drives the 52-week grid
 *   anchor and the entries list filter ; the frise lays out so
 *   `end`'s week sits in the rightmost column.
 * - `dataEnd` — latest date that actually carries data. For the
 *   current year this is `today` (the rest of the year is visible
 *   but empty) ; for past years and the rolling view it equals
 *   `end`.
 *
 * Modes :
 * - `null` (« En cours ») — rolling 52 weeks ending today, like
 *   GitHub's contribution graph.
 * - `currentYear` — Jan 1 → Dec 31, data stops at today.
 * - past year — Jan 1 → Dec 31, fully populated.
 *
 * Specific to the Mood heatmap ; the generic FR formatters live
 * in `core/i18n/date-fr.ts`.
 */
export function rangeFor(
  year: number | null,
  today: Date,
  weeks: number = DEFAULT_HEATMAP_WEEKS,
): { start: Date; end: Date; dataEnd: Date } {
  if (year === null) {
    const start = new Date(today);
    start.setDate(today.getDate() - weeks * HEATMAP_DAYS_PER_WEEK + 1);
    return { start, end: today, dataEnd: today };
  }
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  if (year === today.getFullYear()) {
    return { start: jan1, end: dec31, dataEnd: today };
  }
  return { start: jan1, end: dec31, dataEnd: dec31 };
}
