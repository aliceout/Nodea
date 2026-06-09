import { useMemo, type ReactNode } from 'react';

import { createModuleContexts } from '@/core/contexts/module-contexts';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import type { LoadState } from '@/core/types/load-state';

import type { CanonicalStatus, GoalEntry, SortBy } from './lib/types';
// State hooks — aliased to `…State` so they don't clash with the
// `useGoalsData / Filters / Actions` accessors we re-export from
// the React context below.
import { useGoalsActions as useActionsState } from './state/use-goals-actions';
import { useGoalsData as useDataState, type GoalsStats } from './state/use-goals-data';
import {
  useGoalsFilters as useFiltersState,
  type GoalsGroupBy,
  type GoalsViewMode,
} from './state/use-goals-filters';

// Re-exported for consumers that import the view-mode type
// alongside the `useGoalsFilters` accessor.
export type { GoalsViewMode };

/**
 * Goals page-local state, exposed through three React contexts so
 * consumers re-render only on the slice they actually read.
 *
 *   - `GoalsDataContext`    — `entries` / `load` / `stats`. Bumps
 *     when the page (re)fetches or when a mutation flips an
 *     optimistic update. `stats` is over the **full** entries
 *     array (not the filtered slice) so the « Masquer terminés (N) »
 *     count keeps showing the global done count.
 *   - `GoalsFiltersContext` — raw filter state (`statusFilter` /
 *     `groupBy` / `search` / `sortBy` / `hideDone`), the derived
 *     `filtered` and `groups`, and the matching setters.
 *   - `GoalsActionsContext` — handlers (`cycleStatus`, `editEntry`,
 *     `deleteEntry`, `carryOver`) plus the carry-over dialog UI
 *     state. Callbacks are `useCallback` and read live data via
 *     refs so their identity stays stable across data fetches —
 *     consumers that only need actions don't re-render when
 *     entries change.
 *
 * Split (REFACTO-08) : the file used to host every `useState` /
 * `useEffect` / `useMemo` / `useCallback` inline (~408 LOC). Moved
 * the data fetch + stats to `state/use-goals-data.ts`, the filter
 * logic to `state/use-goals-filters.ts`, and the 4 action callbacks
 * to `state/use-goals-actions.ts`. The provider now orchestrates.
 */

interface GoalsDataValue {
  entries: ReadonlyArray<GoalEntry>;
  load: LoadState;
  stats: GoalsStats;
}

interface GoalsFiltersValue {
  statusFilter: CanonicalStatus | null;
  groupBy: GoalsGroupBy;
  viewMode: GoalsViewMode;
  search: string;
  sortBy: SortBy;
  hideDone: boolean;
  threadFilter: string | null;

  filtered: ReadonlyArray<GoalEntry>;
  groups: ReadonlyArray<readonly [string, GoalEntry[]]>;
  threads: ReadonlyArray<string>;

  setStatusFilter: (next: CanonicalStatus | null) => void;
  setGroupBy: (next: GoalsGroupBy) => void;
  setViewMode: (next: GoalsViewMode) => void;
  setSearch: (next: string) => void;
  setSortBy: (next: SortBy) => void;
  setHideDone: (next: boolean) => void;
  setThreadFilter: (next: string | null) => void;
}

interface GoalsActionsValue {
  carryOverOpen: boolean;
  readingId: string | null;
  /** Inline composer state. `formOpen` toggles the form's visibility
   *  in `PrimaryColumn` ; `editingEntry` is the entry being edited
   *  (or `null` on a fresh create). Mirrors the Mood module's posture
   *  — `openComposer` from the global Zustand slice is no longer used. */
  formOpen: boolean;
  editingEntry: GoalEntry | null;
  openCreateForm: () => void;
  openEditForm: (entry: GoalEntry) => void;
  closeForm: () => void;
  cycleStatus: (entry: GoalEntry) => Promise<void>;
  editEntry: (entry: GoalEntry) => void;
  updateTitle: (entry: GoalEntry, nextTitle: string) => Promise<void>;
  deleteEntry: (entry: GoalEntry) => Promise<void>;
  openReader: (id: string) => void;
  closeReader: () => void;
  openCarryOver: () => void;
  closeCarryOver: () => void;
  carryOver: (
    from: number,
    to: number,
    affected: GoalEntry[],
  ) => Promise<void>;
}

const {
  Provider: GoalsContexts,
  useData: useGoalsData,
  useFilters: useGoalsFilters,
  useActions: useGoalsActions,
} = createModuleContexts<GoalsDataValue, GoalsFiltersValue, GoalsActionsValue>(
  'Goals',
);

// eslint-disable-next-line react-refresh/only-export-components
export { useGoalsData, useGoalsFilters, useGoalsActions };

/* ---- Provider --------------------------------------------------- */

export function GoalsProvider({ children }: { children: ReactNode }) {
  const ctx = useModuleClient('goals');
  const goalsVersion = useNodeaStore((s) => s.goalsVersion);
  const bumpGoalsVersion = useNodeaStore((s) => s.bumpGoalsVersion);

  const data = useDataState(ctx, goalsVersion);
  const filters = useFiltersState(data.entries);
  const actions = useActionsState({
    ctx,
    entries: data.entries,
    setEntries: data.setEntries,
    bumpGoalsVersion,
  });

  // ---- Memoised context values ----

  const dataValue = useMemo<GoalsDataValue>(
    () => ({ entries: data.entries, load: data.load, stats: data.stats }),
    [data.entries, data.load, data.stats],
  );

  const filtersValue = useMemo<GoalsFiltersValue>(
    () => ({
      statusFilter: filters.statusFilter,
      groupBy: filters.groupBy,
      viewMode: filters.viewMode,
      search: filters.search,
      sortBy: filters.sortBy,
      hideDone: filters.hideDone,
      threadFilter: filters.threadFilter,
      filtered: filters.filtered,
      groups: filters.groups,
      threads: filters.threads,
      setStatusFilter: filters.setStatusFilter,
      setGroupBy: filters.setGroupBy,
      setViewMode: filters.setViewMode,
      setSearch: filters.setSearch,
      setSortBy: filters.setSortBy,
      setHideDone: filters.setHideDone,
      setThreadFilter: filters.setThreadFilter,
    }),
    // Field-by-field deps (audit 2026-06) : the state hook returns a
    // fresh object literal every render, so `[filters]` memoised
    // nothing and every provider render re-rendered every consumer
    // of the filters context. Same pattern as Mood / Journal.
    [
      filters.statusFilter,
      filters.groupBy,
      filters.viewMode,
      filters.search,
      filters.sortBy,
      filters.hideDone,
      filters.threadFilter,
      filters.filtered,
      filters.groups,
      filters.threads,
      filters.setStatusFilter,
      filters.setGroupBy,
      filters.setViewMode,
      filters.setSearch,
      filters.setSortBy,
      filters.setHideDone,
      filters.setThreadFilter,
    ],
  );

  const actionsValue = useMemo<GoalsActionsValue>(
    () => ({
      carryOverOpen: actions.carryOverOpen,
      readingId: actions.readingId,
      formOpen: actions.formOpen,
      editingEntry: actions.editingEntry,
      openCreateForm: actions.openCreateForm,
      openEditForm: actions.openEditForm,
      closeForm: actions.closeForm,
      cycleStatus: actions.cycleStatus,
      editEntry: actions.editEntry,
      updateTitle: actions.updateTitle,
      deleteEntry: actions.deleteEntry,
      openReader: actions.openReader,
      closeReader: actions.closeReader,
      openCarryOver: actions.openCarryOver,
      closeCarryOver: actions.closeCarryOver,
      carryOver: actions.carryOver,
    }),
    [
      actions.carryOverOpen,
      actions.readingId,
      actions.formOpen,
      actions.editingEntry,
      actions.openCreateForm,
      actions.openEditForm,
      actions.closeForm,
      actions.cycleStatus,
      actions.editEntry,
      actions.updateTitle,
      actions.deleteEntry,
      actions.openReader,
      actions.closeReader,
      actions.openCarryOver,
      actions.closeCarryOver,
      actions.carryOver,
    ],
  );

  return (
    <GoalsContexts data={dataValue} filters={filtersValue} actions={actionsValue}>
      {children}
    </GoalsContexts>
  );
}
