/**
 * Locale-aware date formatters shared across `flow/` modules.
 *
 * Lived in five copies before the post-`module-refacto` dedup —
 * Mood, Journal, Library, Review, Homepage all built their own
 * `Intl.DateTimeFormat('fr-FR', …)` instances and several
 * re-implemented `toIsoDate` / `parseLocalDate` from scratch.
 * Promoting them here keeps the « what counts as a calendar date »
 * answer in one file ; when one caller needs a different layout,
 * that's a signal to fork *intentionally* rather than to silently
 * drift the copies.
 *
 * Module-specific formatters that aren't re-used (`Review/`'s
 * « 12 mars 14:30 » draft timestamp, `Mood/`'s heatmap-internal
 * cell label) stay co-located with their callers.
 *
 * Tier 3 i18n made the module locale-aware : every formatter
 * now takes the active `language` (from `useI18n().language`).
 * « Aujourd'hui » / « Hier » are no longer baked in — they come
 * from `common.time.{today,yesterday}` and are fed into
 * `formatEntryLabel` as labels.
 */

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
 * Map an app language to a `Intl.*` BCP-47 tag. Right now :
 *   - `'fr'` → `'fr-FR'`
 *   - `'en'` → `'en-US'`
 *   - anything else → forwarded verbatim
 *
 * Centralised here so callers don't sprinkle `language === 'en' ?
 * 'en-US' : 'fr-FR'` ternaries everywhere ; one edit lands the
 * choice for every formatter at once.
 */
export function intlLocale(language: string): string {
  if (language === 'fr') return 'fr-FR';
  if (language === 'en') return 'en-US';
  return language;
}

export interface EntryLabelOptions {
  /** App language (`'fr'`, `'en'`). Maps to a BCP-47 tag for
   *  `Intl.DateTimeFormat`. */
  language: string;
  /** Translated « Aujourd'hui » — comes from `t('common.time.today')`. */
  todayLabel: string;
  /** Translated « Hier » — comes from `t('common.time.yesterday')`. */
  yesterdayLabel: string;
}

/**
 * Display label for a `dateIso` relative to `today` :
 *   - `todayLabel` when the entry's day matches `today`
 *   - `yesterdayLabel` when it's the previous day
 *   - the long form otherwise (with year if cross-year), in
 *     `language` via `Intl.DateTimeFormat`. First letter is
 *     uppercased so list rows read « Samedi 12 mars » instead of
 *     « samedi 12 mars ».
 *
 * Falls back to the raw input when the ISO can't be parsed —
 * defensive against legacy / malformed payloads. Both `today`
 * and the parsed `dateIso` are normalised to local midnight so
 * the « today » / « yesterday » detection stays correct in every
 * timezone.
 */
export function formatEntryLabel(
  dateIso: string,
  today: Date,
  options: EntryLabelOptions,
): string {
  const d = parseLocalDate(dateIso);
  if (Number.isNaN(d.getTime())) return dateIso;
  const refToday = new Date(today);
  refToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 3600 * 1000;
  const diff = Math.floor((refToday.getTime() - d.getTime()) / dayMs);
  if (diff === 0) return options.todayLabel;
  if (diff === 1) return options.yesterdayLabel;

  const locale = intlLocale(options.language);
  const sameYear = d.getFullYear() === refToday.getFullYear();
  // Long form for entries inside the current year — « samedi 12 mars »
  // (no year). For cross-year, drop the weekday (« 12 mars 2024 »
  // already takes the slot).
  const fmt = new Intl.DateTimeFormat(
    locale,
    sameYear
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' },
  );
  const formatted = fmt.format(d);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Render a `YYYY-MM` group key as « Mars 2026 » (FR) /
 * « March 2026 » (EN). Falls back to the raw key if parsing fails
 * (defensive — should never happen on payloads we wrote ourselves).
 */
export function formatMonthLabel(yyyymm: string, language: string): string {
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
  const fmt = new Intl.DateTimeFormat(intlLocale(language), {
    month: 'long',
    year: 'numeric',
  });
  const formatted = fmt.format(new Date(y, m - 1, 1));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Inline date for surfaces that may receive either a full ISO date
 * (`YYYY-MM-DD`) or a year+month-only key (`YYYY-MM`, the legacy
 * `DateMonthPicker` output). Renders the short month name :
 *
 *   - `'2025-01'`     → `'janv. 2025'` (FR) / `'Jan 2025'` (EN)
 *   - `'2025-01-08'`  → `'08 janv. 2025'` (FR) / `'08 Jan 2025'` (EN)
 *
 * Leaves the raw input alone on parse failure or on out-of-range
 * months — the Goals row falls back rather than crashing on a
 * malformed payload.
 */
export function formatPartialDate(dateIso: string, language: string): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(dateIso);
  if (!m) return dateIso;
  const year = m[1] ?? '';
  const monthIdx = Number(m[2]) - 1;
  const day = m[3];
  if (monthIdx < 0 || monthIdx > 11) {
    // Defensive — caller normally feeds 01-12. Reuses the raw digits
    // so the UI keeps rendering instead of crashing.
    return day
      ? `${day} ${m[2] ?? ''} ${year}`.trim()
      : `${m[2] ?? ''} ${year}`.trim();
  }
  const month = new Intl.DateTimeFormat(intlLocale(language), {
    month: 'short',
  }).format(new Date(Number(year), monthIdx, 1));
  return day ? `${day} ${month} ${year}` : `${month} ${year}`;
}

/**
 * Long-form date — « 8 janvier 2025 » (FR) / « January 8, 2025 »
 * (EN), no weekday. Used by the Library review header and the
 * Review list. Returns the raw input on parse failure so the UI
 * keeps rendering rather than crashing on a stale / malformed
 * payload.
 */
export function formatLongDate(rawIso: string, language: string): string {
  const d = new Date(rawIso);
  if (Number.isNaN(d.getTime())) return rawIso;
  const fmt = new Intl.DateTimeFormat(intlLocale(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return fmt.format(d);
}

/** Locale-aware number formatter — wraps `Intl.NumberFormat`
 *  bound to `language` (via `intlLocale`). Used for the Journal
 *  word count, the admin user count, etc. */
export function formatNumber(n: number, language: string): string {
  return new Intl.NumberFormat(intlLocale(language)).format(n);
}

/**
 * 12-element array of month names for `language`, either `'long'`
 * (« janvier » / « January ») or `'short'` (« janv. » / « Jan »).
 * Built on demand from `Intl.DateTimeFormat`. Used by surfaces
 * that pick a month from an index (Mood section heading, streak
 * formatter, MonthSelector chips).
 *
 * Output is never capitalised — call sites that need a leading
 * capital (« Mars » as a heading) do `.charAt(0).toUpperCase()`
 * themselves so the helper stays orthogonal to display rules.
 */
export function getMonthNames(
  language: string,
  style: 'long' | 'short' = 'long',
): ReadonlyArray<string> {
  const fmt = new Intl.DateTimeFormat(intlLocale(language), { month: style });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2000, i, 1)));
}

/**
 * 7-element array of weekday names indexed Monday → Sunday — the
 * convention used by Mood's stats and the heatmap. `Intl` returns
 * Sunday-first (`Date.getDay() === 0`), so we rotate to the
 * Monday-first ordering at the boundary here ; the call sites
 * stay simple.
 *
 * `style` is `'long'` (« lundi » / « Monday ») or `'short'`
 * (« lun. » / « Mon »). Output isn't capitalised — same rule as
 * `getMonthNames`.
 */
export function getDayNames(
  language: string,
  style: 'long' | 'short' = 'long',
): ReadonlyArray<string> {
  const fmt = new Intl.DateTimeFormat(intlLocale(language), { weekday: style });
  // 2024-01-01 was a Monday — pick that as the anchor.
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return fmt.format(d);
  });
}
