/** Long FR date for entries inside the current year — « samedi 12
 *  mars ». No year suffix to keep the inline list compact ; old
 *  entries flip to `ENTRY_CROSS_YEAR_FMT` instead. */
const ENTRY_SAME_YEAR_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Long FR date for entries from previous years — « 12 mars 2024 ».
 *  Drops the weekday since the year already takes the slot ;
 *  reading « lundi 12 mars 2024 » is heavy without adding info. */
const ENTRY_CROSS_YEAR_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Display label for a journal entry's date :
 *   - « Aujourd'hui » when the entry's day matches `today`
 *   - « Hier » when it's the previous day
 *   - the long FR form otherwise (with year if cross-year)
 *
 * Falls back to the raw input when the ISO can't be parsed — the
 * row renders something rather than crashing on legacy / malformed
 * payloads. The `today` parameter makes the function pure and
 * lets tests use a fixed reference date.
 */
export function formatEntryLabel(rawIso: string, today: Date): string {
  const d = new Date(rawIso);
  if (Number.isNaN(d.getTime())) return rawIso;
  const dayMs = 24 * 3600 * 1000;
  const dStart = new Date(d);
  dStart.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - dStart.getTime()) / dayMs);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Hier';
  const fmt =
    d.getFullYear() === today.getFullYear()
      ? ENTRY_SAME_YEAR_FMT
      : ENTRY_CROSS_YEAR_FMT;
  const formatted = fmt.format(d);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** « mars 2026 » formatter for the « par mois » group headers. */
const MONTH_LABEL_FMT = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
});

/**
 * Render a `YYYY-MM` group key as « mars 2026 ». Falls back to the
 * raw key if parsing fails (defensive — should never happen on
 * payloads we wrote ourselves).
 */
export function formatMonthLabel(yyyymm: string): string {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return yyyymm;
  const formatted = MONTH_LABEL_FMT.format(new Date(y, m - 1, 1));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
