/**
 * Journal filters hook (REFACTO-08). Owns the thread / groupBy / search
 * / year / month / day / chart-collapse filter state and derives
 * `threads`, `filtered`, `groups`. Not a React context — republished by
 * the provider via `JournalFiltersValue`.
 *
 * `setChartCollapsed` is returned so the provider can wire it into the
 * actions hook (opening the inline form auto-collapses the chart); the
 * filters *context value* only exposes `toggleChart`.
 */
import { useCallback, useDeferredValue, useMemo, useState } from 'react';

import { splitThreads } from '@nodea/shared';

import { formatMonthLabel } from '@/core/i18n/date-format';
import { matchesHaystack } from '@/lib/text-search';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import type { JournalEntry } from '../lib/types';

export type GroupBy = 'thread' | 'month';

export interface JournalFiltersState {
  threadFilter: string | null;
  groupBy: GroupBy;
  search: string;
  year: number | null;
  month: number | null;
  dayFilter: string | null;
  chartCollapsed: boolean;
  threads: ReadonlyArray<string>;
  filtered: ReadonlyArray<JournalEntry>;
  groups: ReadonlyArray<readonly [string, JournalEntry[]]>;
  setThreadFilter: (next: string | null) => void;
  setGroupBy: (next: GroupBy) => void;
  setSearch: (next: string) => void;
  setYear: (next: number | null) => void;
  setMonth: (next: number | null) => void;
  setDayFilter: (next: string | null) => void;
  toggleChart: () => void;
  setChartCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useJournalFilters(
  entries: ReadonlyArray<JournalEntry>,
): JournalFiltersState {
  const { t, language } = useI18n();

  const [threadFilter, setThreadFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [year, setYearState] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [chartCollapsed, setChartCollapsed] = useState(false);

  // Reset the month when the year changes so a stale month filter
  // doesn't silently empty the list in a year with no entries there.
  const setYear = useCallback((next: number | null) => {
    setYearState(next);
    setMonth(null);
  }, []);

  const toggleChart = useCallback(() => setChartCollapsed((prev) => !prev), []);

  const threads = useMemo<ReadonlyArray<string>>(() => {
    const set = new Set<string>();
    for (const e of entries) {
      for (const th of splitThreads(e.thread)) set.add(th);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [entries]);

  // `useDeferredValue` keeps the search input responsive : the filter +
  // regroup pass runs at deferred priority (audit 2026-06).
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo<ReadonlyArray<JournalEntry>>(() => {
    const trimmedQuery = deferredSearch.trim();
    return entries.filter((e) => {
      if (threadFilter && !splitThreads(e.thread).includes(threadFilter)) {
        return false;
      }
      // Year filter (issue #56). null = « En cours » = no year narrowing.
      if (year !== null && e.dateIso.slice(0, 4) !== String(year)) {
        return false;
      }
      // Month filter — `dateIso` is `YYYY-MM-DD` (chars 5-7 = 1-based
      // month); `month` is 0-based like Date.getMonth().
      if (month !== null && Number(e.dateIso.slice(5, 7)) - 1 !== month) {
        return false;
      }
      // Single-day focus filter (issue #56).
      if (dayFilter && e.dateIso.slice(0, 10) !== dayFilter) {
        return false;
      }
      // Cheap short-circuit when no search is active.
      if (trimmedQuery.length === 0) return true;
      // Search across title + content + thread via the precomputed
      // haystack (thread inclusion is intentional).
      return matchesHaystack(e.searchHaystack, trimmedQuery);
    });
  }, [entries, threadFilter, year, month, dayFilter, deferredSearch]);

  const groups = useMemo<
    ReadonlyArray<readonly [string, JournalEntry[]]>
  >(() => {
    const map = new Map<string, JournalEntry[]>();
    if (groupBy === 'month') {
      // Bucket by raw `YYYY-MM` for sort stability ; translate to
      // « mars 2026 » only on the way out. Descending = freshest on top.
      for (const entry of filtered) {
        const key = entry.dateIso.slice(0, 7);
        const bucket = map.get(key) ?? [];
        bucket.push(entry);
        map.set(key, bucket);
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
        .map(([k, items]) => [formatMonthLabel(k, language), items] as const);
    }
    // Default : group by thread (multi-thread entries land in each of
    // their buckets). The « no thread » bucket reuses the list label.
    const noThreadLabel = t('journal.list.noThread');
    for (const entry of filtered) {
      const keys = splitThreads(entry.thread);
      const list = keys.length > 0 ? keys : [noThreadLabel];
      for (const key of list) {
        const bucket = map.get(key) ?? [];
        bucket.push(entry);
        map.set(key, bucket);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, 'fr'),
    );
  }, [filtered, groupBy, language, t]);

  return {
    threadFilter,
    groupBy,
    search,
    year,
    month,
    dayFilter,
    chartCollapsed,
    threads,
    filtered,
    groups,
    setThreadFilter,
    setGroupBy,
    setSearch,
    setYear,
    setMonth,
    setDayFilter,
    toggleChart,
    setChartCollapsed,
  };
}
