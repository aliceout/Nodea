import { intlLocale } from '@/core/i18n/date-format';

/**
 * Format a goal date for inline display. Accepts `YYYY-MM` (the
 * legacy form's DateMonthPicker output) and `YYYY-MM-DD`. Anything
 * else is rendered as-is — the row falls back to the raw string
 * rather than crashing on a malformed payload.
 *
 * Output shape (FR locale) :
 *   - `'2025-01'`     → `'janv. 2025'`
 *   - `'2025-01-08'`  → `'08 janv. 2025'`
 *
 * Locale-aware as of Tier 3 i18n : passes through `intlLocale` so
 * EN/FR (and any future language) get their native abbreviated
 * month name from `Intl.DateTimeFormat`. The day is left zero-
 * padded — same convention as the legacy hand-rolled formatter.
 */
export function formatDate(dateIso: string, language: string): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(dateIso);
  if (!m) return dateIso;
  const year = m[1] ?? '';
  const monthIdx = Number(m[2]) - 1;
  const day = m[3];
  if (monthIdx < 0 || monthIdx > 11) {
    // Defensive fallback (caller always sends 01-12 in practice ;
    // see DateMonthPicker). Reuses the raw month digits.
    return day ? `${day} ${m[2] ?? ''} ${year}`.trim() : `${m[2] ?? ''} ${year}`.trim();
  }
  const month = new Intl.DateTimeFormat(intlLocale(language), {
    month: 'short',
  }).format(new Date(Number(year), monthIdx, 1));
  return day ? `${day} ${month} ${year}` : `${month} ${year}`;
}
