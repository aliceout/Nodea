import { toIsoDate } from '@/core/i18n/date-format';

import type { JournalEntry, JournalStats } from './types';

/**
 * Aggregate entry-level stats for the SideColumn « Stats » block.
 *
 * - `totalWords` counts whitespace-separated tokens across each
 *   entry's content + title. Cheap, locale-agnostic enough for an
 *   indicator.
 * - `streakDays` walks back from today through `entries` (assumed
 *   newest-first) counting consecutive days with at least one
 *   entry. The streak survives a missing « today » as long as
 *   « yesterday » is covered — a journal you write each evening
 *   shouldn't reset to 0 the moment you wake up.
 *
 * `today` is a parameter (default `new Date()`) so tests can pin
 * the reference instead of fighting the wall clock.
 */
export function computeStats(
  entries: ReadonlyArray<JournalEntry>,
  today: Date = new Date(),
): JournalStats {
  let totalWords = 0;
  const dayKeys = new Set<string>();
  for (const entry of entries) {
    const text = `${entry.title ?? ''} ${entry.content}`;
    totalWords += countWords(text);
    const day = entry.dateIso.slice(0, 10);
    if (day) dayKeys.add(day);
  }
  const refDay = new Date(today);
  refDay.setHours(0, 0, 0, 0);
  const todayKey = toIsoDate(refDay);
  const yesterdayKey = toIsoDate(new Date(refDay.getTime() - 24 * 3600 * 1000));
  const streakIncludesToday = dayKeys.has(todayKey);
  let cursor = streakIncludesToday
    ? new Date(refDay)
    : dayKeys.has(yesterdayKey)
      ? new Date(refDay.getTime() - 24 * 3600 * 1000)
      : null;
  let streakDays = 0;
  while (cursor && dayKeys.has(toIsoDate(cursor))) {
    streakDays += 1;
    cursor = new Date(cursor.getTime() - 24 * 3600 * 1000);
  }
  return {
    totalEntries: entries.length,
    totalWords,
    streakDays,
    streakIncludesToday,
  };
}

/** Whitespace-tokenise word count. Empty strings → 0 ; multiple
 *  spaces collapse via the `\s+` split. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
