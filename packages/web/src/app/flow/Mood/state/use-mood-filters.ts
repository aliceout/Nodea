/**
 * Mood filters hook (REFACTO-08). Owns the year / month / chart-collapse
 * / search / score / day filter state and derives `filtered` (entries
 * inside the selected window AND matching search / score / day). Not a
 * React context — republished by the provider via `MoodFiltersValue`.
 *
 * `setChartCollapsed` is returned so the provider can wire it into the
 * actions hook (opening the inline form auto-collapses the chart) AND expose it
 * on the filters context value — the inline « Paramètre du module » panel folds
 * the chart the same way (cf. Mood/views/PrimaryColumn).
 */
import { useCallback, useDeferredValue, useMemo, useState } from 'react';

import type { MoodScore } from '@nodea/shared';

import { useNodeaStore } from '@/core/store/nodea-store';
import { matchesHaystack } from '@/lib/text-search';

import { rangeFor } from '../lib/date-format';
import type { MoodEntry } from '../lib/types';

export interface MoodFiltersState {
  year: number | null;
  month: number | null;
  chartCollapsed: boolean;
  searchQuery: string;
  scoreFilter: MoodScore | null;
  dayFilter: string | null;
  filtered: ReadonlyArray<MoodEntry>;
  setYear: (next: number | null) => void;
  setMonth: (next: number | null) => void;
  setSearchQuery: (next: string) => void;
  setScoreFilter: (next: MoodScore | null) => void;
  setDayFilter: (next: string | null) => void;
  toggleChart: () => void;
  setChartCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useMoodFilters(
  entries: ReadonlyArray<MoodEntry>,
  today: Date,
): MoodFiltersState {
  const [year, setYearState] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  // Seed the frise's start-of-session state from the persisted default
  // (`moodChartCollapsed`, absent ⇒ false / expanded — current behaviour). Lazy
  // init so a `getState()` read happens once at mount; the toggle + the inline
  // panels still override per session.
  const [chartCollapsed, setChartCollapsed] = useState(
    () => useNodeaStore.getState().preferences.moodChartCollapsed === true,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreFilter, setScoreFilter] = useState<MoodScore | null>(null);
  const [dayFilter, setDayFilter] = useState<string | null>(null);

  // Deferred search — keeps the input responsive while the filter pass
  // runs at deferred priority (audit 2026-06).
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filtered = useMemo<ReadonlyArray<MoodEntry>>(() => {
    const { start, dataEnd } = rangeFor(year, today);
    const startTime = start.getTime();
    const dataEndTime = dataEnd.getTime();
    const trimmedQuery = deferredSearchQuery.trim();
    return entries.filter((entry) => {
      // Parse the ISO components into a LOCAL date so the window bounds
      // (local midnight) and the entry compare on the same axis —
      // `new Date('YYYY-MM-DD')` would parse as UTC and drift a day in
      // timezones east of UTC.
      const [yyyy, mm, dd] = entry.dateIso.split('-').map(Number);
      const d = new Date(yyyy ?? 0, (mm ?? 1) - 1, dd ?? 1);
      const ms = d.getTime();
      if (ms < startTime || ms > dataEndTime) return false;
      if (month !== null && d.getMonth() !== month) return false;
      if (scoreFilter !== null && entry.score !== scoreFilter) return false;
      if (dayFilter !== null && entry.dateIso !== dayFilter) return false;
      // Cheap short-circuit when no search is active.
      if (trimmedQuery.length === 0) return true;
      return matchesHaystack(entry.searchHaystack, trimmedQuery);
    });
  }, [entries, year, month, today, deferredSearchQuery, scoreFilter, dayFilter]);

  // Reset month when switching years so a stale month filter doesn't
  // silently empty the list in a year where that month has no entries.
  const setYear = useCallback((next: number | null) => {
    setYearState(next);
    setMonth(null);
  }, []);

  const toggleChart = useCallback(() => setChartCollapsed((prev) => !prev), []);

  return {
    year,
    month,
    chartCollapsed,
    searchQuery,
    scoreFilter,
    dayFilter,
    filtered,
    setYear,
    setMonth,
    setSearchQuery,
    setScoreFilter,
    setDayFilter,
    toggleChart,
    setChartCollapsed,
  };
}
