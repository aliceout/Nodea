/**
 * HRT · date-range filtering — the shared type + predicate used by the
 * `DateRangeFilter` control and the Administration / Analyses views.
 *
 * Kept out of the component file so the component module exports only a
 * component (react-refresh hygiene), and so both views filter through
 * one predicate rather than re-inlining the bounds check.
 */

export interface DateRange {
  /** Inclusive lower bound, ISO `YYYY-MM-DD` ; '' = no lower bound. */
  from: string;
  /** Inclusive upper bound, ISO `YYYY-MM-DD` ; '' = no upper bound. */
  to: string;
}

/** The unbounded range — the caller's initial state (no filtering). */
export const EMPTY_RANGE: DateRange = { from: '', to: '' };

/**
 * Whether an ISO `YYYY-MM-DD` date falls within the (inclusive) range.
 * ISO dates sort lexicographically, so plain string comparison is safe.
 */
export function inDateRange(dateIso: string, range: DateRange): boolean {
  return (!range.from || dateIso >= range.from) && (!range.to || dateIso <= range.to);
}
