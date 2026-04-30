/**
 * FR date formatters shared across `flow/` modules.
 *
 * Lived in five copies before the post-`module-refacto` dedup —
 * Mood, Journal, Library, Review, Homepage all built their own
 * `Intl.DateTimeFormat('fr-FR', …)` instances and several
 * re-implemented `toIsoDate` / `parseLocalDate` from scratch.
 * Promoting them here keeps the « what counts as a French date »
 * answer in one file ; when one caller needs a different layout,
 * that's a signal to fork *intentionally* rather than to silently
 * drift the copies.
 *
 * Module-specific formatters that aren't re-used (`Review/`'s
 * « 12 mars 14:30 » draft timestamp, `Mood/`'s heatmap-internal
 * cell label) stay co-located with their callers.
 */

/** Long FR date for entries inside the current year — « samedi
 *  12 mars ». No year suffix to keep inline lists compact ; older
 *  entries flip to `ENTRY_CROSS_YEAR_FMT` instead. */
const ENTRY_SAME_YEAR_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Long FR date for cross-year entries — « 12 mars 2024 ». Drops
 *  the weekday since the year already takes the slot ; reading
 *  « lundi 12 mars 2024 » is heavy without adding info. */
const ENTRY_CROSS_YEAR_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** « mars 2026 » — month + year. Drives the « par mois » group
 *  headers in Journal and any other surface that buckets by
 *  calendar month. */
const MONTH_LABEL_FMT = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
});

/** « 8 janvier 2025 » — day + month + year, no weekday. Used by
 *  the Library review header and the Review list (one entry per
 *  year, so the weekday wouldn't add info). */
const LONG_DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Parse a `YYYY-MM-DD[T...]` ISO string as a local date at
 * midnight, regardless of the runtime timezone. The default
 * `new Date(iso)` parses a bare `YYYY-MM-DD` as **UTC** midnight,
 * which drifts to the previous local day in UTC− zones — that
 * broke the « Aujourd'hui » detection in Mood before this fix
 * landed. Returns Invalid Date when the input doesn't match the
 * expected pattern. Tolerant of trailing time / timezone suffixes
 * — only the date prefix is consumed.
 */
export function parseLocalDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Local-TZ ISO date (`YYYY-MM-DD`) for a `Date`, no time
 *  component. Used by the Mood heatmap and the Homepage frise to
 *  look entries up by day. Round-trip with `parseLocalDate` :
 *  `parseLocalDate(toIsoDate(d))` returns a `Date` at the same
 *  local midnight. */
export function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Display label for a `dateIso` relative to `today` :
 *   - « Aujourd'hui » when the entry's day matches `today`
 *   - « Hier » when it's the previous day
 *   - the long FR form otherwise (with year if cross-year)
 *
 * Falls back to the raw input when the ISO can't be parsed —
 * defensive against legacy / malformed payloads. Both `today`
 * and the parsed `dateIso` are normalised to local midnight so
 * the « today » / « yesterday » detection stays correct in every
 * timezone.
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

/**
 * Render a `YYYY-MM` group key as « Mars 2026 ». Falls back to
 * the raw key if parsing fails (defensive — should never happen
 * on payloads we wrote ourselves).
 */
export function formatMonthLabel(yyyymm: string): string {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  // `Number('')` is `0` (not `NaN`), so an explicit range check
  // on `m` is required — otherwise `'2026-'` would be accepted
  // and rendered as « Décembre 2025 » via the `Date(y, -1, 1)`
  // wrap.
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return yyyymm;
  }
  const formatted = MONTH_LABEL_FMT.format(new Date(y, m - 1, 1));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Long-form FR date — « 8 janvier 2025 », no weekday. Used by
 * the Library review header and the Review list. Returns the
 * raw input on parse failure so the UI keeps rendering rather
 * than crashing on a stale / malformed payload.
 */
export function formatLongDate(rawIso: string): string {
  const d = new Date(rawIso);
  if (Number.isNaN(d.getTime())) return rawIso;
  return LONG_DATE_FMT.format(d);
}
