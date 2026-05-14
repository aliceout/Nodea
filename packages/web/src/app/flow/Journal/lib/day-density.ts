import { countWords, isoDay } from './stats';
import type { JournalEntry } from './types';

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

/** `YYYY-MM-DD` shape check : a length-10 slice alone isn't enough
 *  (a stray `not-a-date` is exactly 10 chars). Anchored regex
 *  filters out truncated / malformed `dateIso` values defensively. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function aggregateByDay(
  entries: ReadonlyArray<JournalEntry>,
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
 * single 1 500-word entry is more « active » than three 30-word
 * one-liners. Bucket boundaries hand-tuned for journal-realistic
 * densities :
 *   - 0 words : empty day
 *   - 1-99 words : a casual line
 *   - 100-299 words : a paragraph
 *   - 300-799 words : a real session
 *   - 800+ words : a deep dive
 *
 * Exported separately from `aggregateByDay` so callers that only
 * need the count (e.g. a sparkline) don't pay the bucketing cost.
 */
export function densityToIntensity(density: DayDensity | undefined): number {
  if (!density || density.words === 0) return 0;
  if (density.words < 100) return 1;
  if (density.words < 300) return 2;
  if (density.words < 800) return 3;
  return 4;
}

/** Convenience : build the heatmap lookup function the Heatmap
 *  component expects. Returns 0 for any day without entries. */
export function buildIntensityLookup(
  entries: ReadonlyArray<JournalEntry>,
): (date: Date) => number {
  const byDay = aggregateByDay(entries);
  return (date) => densityToIntensity(byDay.get(isoDay(date)));
}
