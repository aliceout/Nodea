/**
 * Per-thread statistics for the Journal thread manager (issue #57).
 *
 * Pure — depends only on the decrypted entries already in memory.
 * The manager modal mounts on demand so this runs at most when the
 * user opens the panel ; we don't pay for it on the regular list.
 */
import { splitThreads } from '@nodea/shared';

import { countWords } from './stats';
import type { JournalEntry } from './types';

export interface ThreadStats {
  name: string;
  entryCount: number;
  totalWords: number;
  /** Earliest ISO date among entries that carry this thread, or
   *  null when the entries have no date populated. */
  firstDateIso: string | null;
  /** Latest ISO date among entries that carry this thread. */
  lastDateIso: string | null;
}

/**
 * Aggregate per-thread stats across all decrypted entries. Multi-
 * thread entries count towards each of their threads — same
 * convention as the list-page « group by thread » bucketing. The
 * output is sorted alphabetically (French locale) so the manager
 * row order is stable across re-renders.
 *
 * `wordCount` follows the same definition as the sidebar global
 * stat — whitespace-split after trim ; punctuation is part of the
 * adjacent token. Empty content contributes 0.
 */
export function computeThreadStats(
  entries: ReadonlyArray<JournalEntry>,
): ReadonlyArray<ThreadStats> {
  const byName = new Map<
    string,
    { entryCount: number; totalWords: number; firstIso: string | null; lastIso: string | null }
  >();

  for (const entry of entries) {
    const threads = splitThreads(entry.thread);
    if (threads.length === 0) continue;
    const words = countWords(entry.content);
    for (const name of threads) {
      const bucket =
        byName.get(name) ??
        { entryCount: 0, totalWords: 0, firstIso: null, lastIso: null };
      bucket.entryCount += 1;
      bucket.totalWords += words;
      const iso = entry.dateIso || null;
      if (iso) {
        if (bucket.firstIso === null || iso < bucket.firstIso) bucket.firstIso = iso;
        if (bucket.lastIso === null || iso > bucket.lastIso) bucket.lastIso = iso;
      }
      byName.set(name, bucket);
    }
  }

  return Array.from(byName.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .map(([name, b]) => ({
      name,
      entryCount: b.entryCount,
      totalWords: b.totalWords,
      firstDateIso: b.firstIso,
      lastDateIso: b.lastIso,
    }));
}
