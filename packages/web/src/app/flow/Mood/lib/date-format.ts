/** Long FR date for entries inside the current year — « lundi 12
 *  mars ». No year suffix to keep the inline list compact. */
const ENTRY_SAME_YEAR_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Long FR date for cross-year entries — « 12 mars 2024 ». Drops
 *  the weekday since the year already takes the slot. */
const ENTRY_CROSS_YEAR_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Parse a `YYYY-MM-DD[T...]` ISO string as a local date at
 *  midnight, regardless of the runtime timezone. The default
 *  `new Date(iso)` parses YYYY-MM-DD as UTC midnight, which
 *  drifts to the previous local day in UTC− zones — that broke
 *  the « Aujourd'hui » detection. Returns Invalid Date when the
 *  input doesn't match the expected pattern. */
function parseLocalDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Display label for a Mood entry's date :
 *   - « Aujourd'hui » when the entry's day matches `today`
 *   - « Hier » when it's the previous day
 *   - the long FR form otherwise (with year if cross-year)
 *
 * Falls back to the raw input when the ISO can't be parsed —
 * defensive against legacy / malformed payloads. Both `today`
 * and the parsed `dateIso` are normalised to local midnight so
 * the « today » / « yesterday » detection stays correct in every
 * timezone (the pre-refacto inline version mis-detected « today »
 * as « hier » in UTC+ zones because `new Date('YYYY-MM-DD')`
 * parses as UTC midnight).
 */
export function formatEntryLabel(dateIso: string, today: Date): string {
  const d = parseLocalDate(dateIso);
  if (Number.isNaN(d.getTime())) return dateIso;
  const refToday = new Date(today);
  refToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 3600 * 1000;
  const diff = Math.floor((refToday.getTime() - d.getTime()) / dayMs);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Hier';
  const fmt =
    d.getFullYear() === refToday.getFullYear()
      ? ENTRY_SAME_YEAR_FMT
      : ENTRY_CROSS_YEAR_FMT;
  const formatted = fmt.format(d);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** Local-TZ ISO date (`YYYY-MM-DD`) for a `Date`, no time
 *  component. Used by the heatmap to look entries up by day. */
export function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Number of weeks the heatmap spans — re-exported here so
 *  `rangeFor` can use it without importing from `heatmap.ts`
 *  (avoids a circular dep between date-format ↔ heatmap). */
const HEATMAP_WEEKS = 52;
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
 */
export function rangeFor(
  year: number | null,
  today: Date,
): { start: Date; end: Date; dataEnd: Date } {
  if (year === null) {
    const start = new Date(today);
    start.setDate(today.getDate() - HEATMAP_WEEKS * HEATMAP_DAYS_PER_WEEK + 1);
    return { start, end: today, dataEnd: today };
  }
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  if (year === today.getFullYear()) {
    return { start: jan1, end: dec31, dataEnd: today };
  }
  return { start: jan1, end: dec31, dataEnd: dec31 };
}
