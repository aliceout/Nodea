/** Long-form FR date used in the review header (« 8 janvier 2025 »).
 *  Module-level so the formatter is constructed once, not on every
 *  render. */
const REVIEW_DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Format an ISO date string for review row headers. Returns the
 *  raw string unchanged when the input fails to parse — keeps the
 *  UI rendering rather than crashing on a stale / malformed
 *  payload, while still surfacing the bad value visibly. */
export function formatReviewDate(rawIso: string): string {
  const d = new Date(rawIso);
  if (Number.isNaN(d.getTime())) return rawIso;
  return REVIEW_DATE_FMT.format(d);
}
