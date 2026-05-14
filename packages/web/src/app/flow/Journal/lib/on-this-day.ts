import type { JournalEntry } from './types';

/**
 * « Il y a un an » selector (issue #58, inspiration Day One).
 *
 * Given the full list of journal entries and a reference date,
 * returns the entries written on the same calendar day (MM-DD) in
 * earlier years — newest first, up to `limit`. Today's own entries
 * are excluded so the panel reads as « a glance at the past »
 * rather than « what you wrote earlier today ».
 *
 * Pure function, no side effect. Date arithmetic stays on
 * `dateIso.slice(...)` substrings so we don't accidentally cross a
 * timezone boundary by re-parsing the ISO string into a `Date`
 * (same rationale as the Mood `dateIso` filter, cf. issue
 * #fix-mood-timezone).
 *
 * @param entries   newest-first list (Journal context already sorts)
 * @param today     reference day ; defaults to `new Date()`
 * @param limit     max entries to return (default 3 — beyond that
 *                  the panel reads as a wall of text rather than
 *                  a glance)
 */
export function pickOnThisDay(
  entries: ReadonlyArray<JournalEntry>,
  today: Date = new Date(),
  limit = 3,
): ReadonlyArray<JournalEntry> {
  const mmdd = formatMonthDay(today);
  const todayYear = today.getFullYear();

  const same = entries.filter((entry) => {
    const day = entry.dateIso.slice(0, 10);
    if (day.length < 10) return false;
    if (day.slice(5) !== mmdd) return false;
    const year = Number.parseInt(day.slice(0, 4), 10);
    if (Number.isNaN(year)) return false;
    return year < todayYear;
  });

  // Newest first — already true if `entries` is sorted desc, but
  // we don't assume the caller's ordering here.
  same.sort((a, b) => b.dateIso.localeCompare(a.dateIso));

  return same.slice(0, limit);
}

/** `MM-DD` for a `Date`, zero-padded, local time. Exported for the
 *  tests ; the panel-render code only needs `pickOnThisDay`. */
export function formatMonthDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}-${day}`;
}

/** Whole-year delta between `today` and the entry's year.
 *  Always positive in practice because `pickOnThisDay` already
 *  filters earlier years. Useful for the panel's i18n label
 *  (« il y a 1 an », « il y a 3 ans »). */
export function yearsAgo(entry: JournalEntry, today: Date = new Date()): number {
  const year = Number.parseInt(entry.dateIso.slice(0, 4), 10);
  if (Number.isNaN(year)) return 0;
  return Math.max(0, today.getFullYear() - year);
}
