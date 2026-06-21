import { useMemo, type ReactNode } from 'react';

import type { MoodPayload, MoodScore } from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { createModuleContexts } from '@/core/contexts/module-contexts';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import type { LoadState } from '@/core/types/load-state';

import type { MoodEntry } from './lib/types';
// State hooks — aliased to `…State` so they don't clash with the
// `useMoodData / Filters / Actions` accessors re-exported below.
import { useMoodActions as useActionsState } from './state/use-mood-actions';
import { useMoodData as useDataState } from './state/use-mood-data';
import { useMoodFilters as useFiltersState } from './state/use-mood-filters';

/**
 * Mood page-local state, exposed through three React contexts so
 * consumers re-render only on the slice they read.
 *
 *   - `MoodDataContext`    — `entries` / `load` / `availableYears`
 *     / `today`. The full set, ignoring filters ; used by Chart
 *     (heatmap), the SideColumn (donut + patterns) and the year selector.
 *   - `MoodFiltersContext` — `year` / `month` / `chartCollapsed` +
 *     setters, plus the derived `filtered`. Changes on every click.
 *   - `MoodActionsContext` — `editEntry` / `deleteEntry` / … . Identity
 *     stays stable across data fetches, so leaves that only consume
 *     actions do not re-render when entries change.
 *
 * Split (REFACTO-08, same as Goals / Library) : the provider used to
 * host every `useState` / `useEffect` / `useMemo` / `useCallback`
 * inline (~423 LOC). The data fetch + `today` + `availableYears` moved
 * to `state/use-mood-data.ts`, the filter logic to
 * `state/use-mood-filters.ts`, and the form + mutation handlers to
 * `state/use-mood-actions.ts`. The provider now only orchestrates +
 * memoises the three context values.
 */

interface MoodDataValue {
  entries: ReadonlyArray<MoodEntry>;
  load: LoadState;
  /** Years with at least one entry, sorted descending. Falls back to
   *  `[currentYear]` so the YearSelector never renders blank. */
  availableYears: ReadonlyArray<number>;
  /** Reference « today » normalised to local midnight, captured once
   *  per provider mount. */
  today: Date;
}

interface MoodFiltersValue {
  year: number | null;
  month: number | null;
  chartCollapsed: boolean;
  /** Free-text search query (cf. issue #92). Combines with year/month
   *  via AND ; an empty string disables the filter. */
  searchQuery: string;
  /** Donut-driven score filter. `null` = all scores. */
  scoreFilter: MoodScore | null;
  /** Heatmap-driven single-day filter. `null` = no day narrowing. */
  dayFilter: string | null;
  /** Entries inside the selected year × month window AND matching the
   *  current search / score / day filters. */
  filtered: ReadonlyArray<MoodEntry>;
  setYear: (next: number | null) => void;
  setMonth: (next: number | null) => void;
  setSearchQuery: (next: string) => void;
  setScoreFilter: (next: MoodScore | null) => void;
  setDayFilter: (next: string | null) => void;
  toggleChart: () => void;
}

interface MoodActionsValue {
  /** When `true`, `PrimaryColumn` renders `MoodForm` above the list. */
  formOpen: boolean;
  /** The entry being edited, or `null` for a fresh « create » flow. */
  editingEntry: MoodEntry | null;
  openCreateForm: () => void;
  /** Kept as `editEntry` too (alias) so EntryRow markup compiles. */
  openEditForm: (entry: MoodEntry) => void;
  editEntry: (entry: MoodEntry) => void;
  closeForm: () => void;
  deleteEntry: (entry: MoodEntry) => Promise<void>;
  /** Insert / replace a single record locally after the form saved it —
   *  avoids a full-collection refetch on every save. */
  upsertRecord: (record: DecryptedRecord<MoodPayload>) => void;
}

const {
  Provider: MoodContexts,
  useData: useMoodData,
  useFilters: useMoodFilters,
  useActions: useMoodActions,
} = createModuleContexts<MoodDataValue, MoodFiltersValue, MoodActionsValue>(
  'Mood',
);

// eslint-disable-next-line react-refresh/only-export-components
export { useMoodData, useMoodFilters, useMoodActions };

/* ---- Provider --------------------------------------------------- */

export function MoodProvider({ children }: { children: ReactNode }) {
  const ctx = useModuleClient('mood');
  const moodVersion = useNodeaStore((s) => s.moodVersion);

  const data = useDataState(ctx, moodVersion);
  const filters = useFiltersState(data.entries, data.today);
  const actions = useActionsState({
    ctx,
    entries: data.entries,
    setEntries: data.setEntries,
    today: data.today,
    // Opening the form auto-collapses the chart — that state lives in
    // the filters hook, threaded in here.
    setChartCollapsed: filters.setChartCollapsed,
  });

  // ---- Memoised context values ----

  const dataValue = useMemo<MoodDataValue>(
    () => ({
      entries: data.entries,
      load: data.load,
      availableYears: data.availableYears,
      today: data.today,
    }),
    [data.entries, data.load, data.availableYears, data.today],
  );

  // Field-by-field deps (audit 2026-06) : the state hooks return a fresh
  // object literal every render, so `[filters]` / `[actions]` would
  // memoise nothing and re-render every consumer on every provider
  // render. Same pattern as Goals / Library.
  const filtersValue = useMemo<MoodFiltersValue>(
    () => ({
      year: filters.year,
      month: filters.month,
      chartCollapsed: filters.chartCollapsed,
      searchQuery: filters.searchQuery,
      scoreFilter: filters.scoreFilter,
      dayFilter: filters.dayFilter,
      filtered: filters.filtered,
      setYear: filters.setYear,
      setMonth: filters.setMonth,
      setSearchQuery: filters.setSearchQuery,
      setScoreFilter: filters.setScoreFilter,
      setDayFilter: filters.setDayFilter,
      toggleChart: filters.toggleChart,
    }),
    [
      filters.year,
      filters.month,
      filters.chartCollapsed,
      filters.searchQuery,
      filters.scoreFilter,
      filters.dayFilter,
      filters.filtered,
      filters.setYear,
      filters.setMonth,
      filters.setSearchQuery,
      filters.setScoreFilter,
      filters.setDayFilter,
      filters.toggleChart,
    ],
  );

  const actionsValue = useMemo<MoodActionsValue>(
    () => ({
      formOpen: actions.formOpen,
      editingEntry: actions.editingEntry,
      openCreateForm: actions.openCreateForm,
      openEditForm: actions.openEditForm,
      editEntry: actions.editEntry,
      closeForm: actions.closeForm,
      deleteEntry: actions.deleteEntry,
      upsertRecord: actions.upsertRecord,
    }),
    [
      actions.formOpen,
      actions.editingEntry,
      actions.openCreateForm,
      actions.openEditForm,
      actions.editEntry,
      actions.closeForm,
      actions.deleteEntry,
      actions.upsertRecord,
    ],
  );

  return (
    <MoodContexts data={dataValue} filters={filtersValue} actions={actionsValue}>
      {children}
    </MoodContexts>
  );
}
