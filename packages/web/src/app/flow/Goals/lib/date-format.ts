/** Abbreviated FR month names — same shape as Intl's `month:
 *  'short'` formatter, but stable across ICU versions and free of
 *  the trailing `.` flicker some Node ICU builds emit. Used by
 *  `formatDate` to render goal row dates. */
export const FRENCH_MONTHS: ReadonlyArray<string> = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

/**
 * Format a goal date for inline display. Accepts `YYYY-MM` (the
 * legacy form's DateMonthPicker output) and `YYYY-MM-DD`. Anything
 * else is rendered as-is — the row falls back to the raw string
 * rather than crashing on a malformed payload.
 */
export function formatDate(dateIso: string): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(dateIso);
  if (!m) return dateIso;
  const year = m[1] ?? '';
  const monthIdx = Number(m[2]) - 1;
  const month = FRENCH_MONTHS[monthIdx] ?? m[2] ?? '';
  const day = m[3];
  return day ? `${day} ${month} ${year}` : `${month} ${year}`;
}
