import { useMemo, type ReactNode } from 'react';

import type { JournalPayload } from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { createModuleContexts } from '@/core/contexts/module-contexts';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import type { LoadState } from '@/core/types/load-state';

import type { JournalEntry, JournalStats } from './lib/types';
// State hooks — aliased to `…State` so they don't clash with the
// `useJournalData / Filters / Actions` accessors re-exported below.
import {
  useJournalActions as useActionsState,
  type ThreadMutationResult,
} from './state/use-journal-actions';
import { useJournalData as useDataState } from './state/use-journal-data';
import {
  useJournalFilters as useFiltersState,
  type GroupBy,
} from './state/use-journal-filters';

// Re-exported for consumers that import the result type alongside the
// `useJournalActions` accessor (e.g. `ThreadsManagerModal`).
export type { ThreadMutationResult };

/**
 * Journal page-local state, exposed through three React contexts so
 * consumers re-render only on the slice they read.
 *
 *   - `JournalDataContext`    — `entries` / `load` / `stats` /
 *     `availableYears` (the « Stats » block + year strip count the full
 *     set, ignoring filters).
 *   - `JournalFiltersContext` — `threadFilter` / `groupBy` / `search` /
 *     `year` / `month` / `dayFilter` / `chartCollapsed` + setters, plus
 *     the derived `threads` / `filtered` / `groups`.
 *   - `JournalActionsContext` — composer + reader UI state, the entry
 *     mutation handlers, and the bulk thread-mutation engine. Callbacks
 *     stay identity-stable across data fetches (refs), so action-only
 *     leaves don't re-render when entries change.
 *
 * Split (REFACTO-08, same as Goals / Library / Mood) : the provider used
 * to host every `useState` / `useEffect` / `useMemo` / `useCallback`
 * inline (~615 LOC). The data fetch + stats + availableYears moved to
 * `state/use-journal-data.ts`, the filter / grouping logic to
 * `state/use-journal-filters.ts`, and the reader + composer + delete /
 * upsert + thread-mutation engine to `state/use-journal-actions.ts`. The
 * provider now only orchestrates + memoises the three context values.
 */

interface JournalDataValue {
  entries: ReadonlyArray<JournalEntry>;
  load: LoadState;
  stats: JournalStats;
  /** Years present in the dataset, descending (issue #56). */
  availableYears: ReadonlyArray<number>;
}

interface JournalFiltersValue {
  threadFilter: string | null;
  groupBy: GroupBy;
  search: string;
  /** Year filter (issue #56). `null` = « En cours » (rolling 52 weeks). */
  year: number | null;
  /** Month filter (0-11) inside the selected year ; `null` = all. */
  month: number | null;
  /** Single-day focus filter — ISO `YYYY-MM-DD` ; `null` = no day focus. */
  dayFilter: string | null;
  /** Heatmap collapse state (issue #56). */
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
}

interface JournalActionsValue {
  /** Id of the entry in the focus reader, or `null` for the list view. */
  readingId: string | null;
  formOpen: boolean;
  editingEntry: JournalEntry | null;
  openCreateForm: () => void;
  openEditForm: (entry: JournalEntry) => void;
  closeForm: () => void;
  editEntry: (entry: JournalEntry) => void;
  deleteEntry: (entry: JournalEntry) => Promise<void>;
  /** Insert-or-replace a single record locally after a form save —
   *  avoids a full-collection refetch on every save. */
  upsertRecord: (record: DecryptedRecord<JournalPayload>) => void;
  openReader: (id: string) => void;
  closeReader: () => void;
  /** Rename a thread across every entry that carries it (issue #57).
   *  Renaming into an existing name is a de facto merge (the helper
   *  dedups on collision). */
  renameThread: (from: string, to: string) => Promise<ThreadMutationResult>;
  /** Drop a thread from every entry that carries it. */
  deleteThread: (target: string) => Promise<ThreadMutationResult>;
}

const {
  Provider: JournalContexts,
  useData: useJournalData,
  useFilters: useJournalFilters,
  useActions: useJournalActions,
} = createModuleContexts<
  JournalDataValue,
  JournalFiltersValue,
  JournalActionsValue
>('Journal');

// eslint-disable-next-line react-refresh/only-export-components
export { useJournalData, useJournalFilters, useJournalActions };

/* ---- Provider --------------------------------------------------- */

export function JournalProvider({ children }: { children: ReactNode }) {
  const ctx = useModuleClient('journal');
  const journalVersion = useNodeaStore((s) => s.journalVersion);
  const bumpJournalVersion = useNodeaStore((s) => s.bumpJournalVersion);

  const data = useDataState(ctx, journalVersion);
  const filters = useFiltersState(data.entries);
  const actions = useActionsState({
    ctx,
    entries: data.entries,
    setEntries: data.setEntries,
    bumpJournalVersion,
    // Opening the form auto-collapses the chart — that state lives in
    // the filters hook, threaded in here.
    setChartCollapsed: filters.setChartCollapsed,
  });

  // ---- Memoised context values ----

  const dataValue = useMemo<JournalDataValue>(
    () => ({
      entries: data.entries,
      load: data.load,
      stats: data.stats,
      availableYears: data.availableYears,
    }),
    [data.entries, data.load, data.stats, data.availableYears],
  );

  // Field-by-field deps (audit 2026-06) : the state hooks return a fresh
  // object literal every render, so `[filters]` / `[actions]` would
  // memoise nothing. Same pattern as Goals / Library / Mood.
  const filtersValue = useMemo<JournalFiltersValue>(
    () => ({
      threadFilter: filters.threadFilter,
      groupBy: filters.groupBy,
      search: filters.search,
      year: filters.year,
      month: filters.month,
      dayFilter: filters.dayFilter,
      chartCollapsed: filters.chartCollapsed,
      threads: filters.threads,
      filtered: filters.filtered,
      groups: filters.groups,
      setThreadFilter: filters.setThreadFilter,
      setGroupBy: filters.setGroupBy,
      setSearch: filters.setSearch,
      setYear: filters.setYear,
      setMonth: filters.setMonth,
      setDayFilter: filters.setDayFilter,
      toggleChart: filters.toggleChart,
    }),
    [
      filters.threadFilter,
      filters.groupBy,
      filters.search,
      filters.year,
      filters.month,
      filters.dayFilter,
      filters.chartCollapsed,
      filters.threads,
      filters.filtered,
      filters.groups,
      filters.setThreadFilter,
      filters.setGroupBy,
      filters.setSearch,
      filters.setYear,
      filters.setMonth,
      filters.setDayFilter,
      filters.toggleChart,
    ],
  );

  const actionsValue = useMemo<JournalActionsValue>(
    () => ({
      readingId: actions.readingId,
      formOpen: actions.formOpen,
      editingEntry: actions.editingEntry,
      openCreateForm: actions.openCreateForm,
      openEditForm: actions.openEditForm,
      closeForm: actions.closeForm,
      editEntry: actions.editEntry,
      deleteEntry: actions.deleteEntry,
      upsertRecord: actions.upsertRecord,
      openReader: actions.openReader,
      closeReader: actions.closeReader,
      renameThread: actions.renameThread,
      deleteThread: actions.deleteThread,
    }),
    [
      actions.readingId,
      actions.formOpen,
      actions.editingEntry,
      actions.openCreateForm,
      actions.openEditForm,
      actions.closeForm,
      actions.editEntry,
      actions.deleteEntry,
      actions.upsertRecord,
      actions.openReader,
      actions.closeReader,
      actions.renameThread,
      actions.deleteThread,
    ],
  );

  return (
    <JournalContexts data={dataValue} filters={filtersValue} actions={actionsValue}>
      {children}
    </JournalContexts>
  );
}
