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

/** The `DateRangeFilter` preset keys, minus 'custom' (which needs explicit
 *  dates) — mirrors `HrtDateRangePreferenceSchema`. */
export type DateRangePreset = 'all' | '30d' | '3m' | '6m' | '12m';

/**
 * Clamp the stored `hrtDefaultDateRange` pref to a known preset, defaulting
 * to 'all' (the current unbounded behaviour) when absent or unknown — so a
 * missing/future-version value degrades to zero filtering, no regression.
 */
export function clampDateRangePreset(value: string | undefined): DateRangePreset {
  return value === '30d' || value === '3m' || value === '6m' || value === '12m'
    ? value
    : 'all';
}

/**
 * Whether an ISO `YYYY-MM-DD` date falls within the (inclusive) range.
 * ISO dates sort lexicographically, so plain string comparison is safe.
 */
export function inDateRange(dateIso: string, range: DateRange): boolean {
  return (!range.from || dateIso >= range.from) && (!range.to || dateIso <= range.to);
}
