import { countWords, isoDay } from './stats';

/**
 * Per-day writing density for the Journal heatmap (issue #56).
 *
 * Aggregates the entry list into a `Map<iso-day, { count, words }>`
 * so the calendar view can colour each cell by activity at O(1)
 * lookup time. The picking strategy stays here (not in the
 * Heatmap component) because « intensity » bucketing is a Journal-
 * specific decision : Habits would bucket by log count, Mood by
 * score, Library would bucket differently again.
 */
export interface DayDensity {
  /** Number of entries written that day. */
  count: number;
  /** Total word count across those entries (title + content). */
  words: number;
}

/**
 * Minimal shape `aggregateByDay` reads. Both the canonical
 * `JournalEntry` and the homepage's `JournalEntryLite` satisfy
 * it, which lets the homepage feed the aggregator without
 * dragging the full Journal entry shape (and its mapper) into
 * its dependency graph.
 */
export interface DayDensityInput {
  dateIso: string;
  title: string | null;
  content: string;
}

/** `YYYY-MM-DD` shape check : a length-10 slice alone isn't enough
 *  (a stray `not-a-date` is exactly 10 chars). Anchored regex
 *  filters out truncated / malformed `dateIso` values defensively. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function aggregateByDay(
  entries: ReadonlyArray<DayDensityInput>,
): Map<string, DayDensity> {
  const out = new Map<string, DayDensity>();
  for (const entry of entries) {
    const day = entry.dateIso.slice(0, 10);
    if (!ISO_DAY.test(day)) continue;
    const text = `${entry.title ?? ''} ${entry.content}`;
    const words = countWords(text);
    const prev = out.get(day);
    if (prev) {
      out.set(day, { count: prev.count + 1, words: prev.words + words });
    } else {
      out.set(day, { count: 1, words });
    }
  }
  return out;
}

/**
 * Map a `DayDensity` to a 0..4 intensity bucket for the heatmap.
 *
 * Thresholds are word-count-based (not entry-count) because a
 * single 200-word entry is more « active » than two 20-word
 * one-liners. Bucket boundaries tuned for typical journal
 * writing — a casual line is usually 10-30 words, a paragraph
 * 50-100, a real session a couple hundred. Earlier thresholds
 * (1/100/300/800) were calibrated for longform journaling and
 * collapsed every short-note user to bucket 1.
 *
 *   - 0 words : empty day
 *   - 1-29 words : a quick line
 *   - 30-79 words : a couple of sentences
 *   - 80-199 words : a paragraph or two
 *   - 200+ words : a real session
 *
 * Exported separately from `aggregateByDay` so callers that only
 * need the count (e.g. a sparkline) don't pay the bucketing cost.
 */
export function densityToIntensity(density: DayDensity | undefined): number {
  if (!density || density.words === 0) return 0;
  if (density.words < 30) return 1;
  if (density.words < 80) return 2;
  if (density.words < 200) return 3;
  return 4;
}

/** Convenience : build the heatmap lookup function the Heatmap
 *  component expects. Returns 0 for any day without entries. */
export function buildIntensityLookup(
  entries: ReadonlyArray<DayDensityInput>,
): (date: Date) => number {
  const byDay = aggregateByDay(entries);
  return (date) => densityToIntensity(byDay.get(isoDay(date)));
}
