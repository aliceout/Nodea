import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { MoodScore } from '@nodea/shared';

import { moodClient } from '@/core/api/modules/mood';
import { createModuleContexts } from '@/core/contexts/module-contexts';
import { useModuleClient } from '@/core/modules/use-module-client';
import { createMutationTracker } from '@/core/state/mutation-tracker';
import { useNodeaStore } from '@/core/store/nodea-store';
import type { LoadState } from '@/core/types/load-state';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import { matchesAnyField } from '@/lib/text-search';

import { rangeFor } from './lib/date-format';
import { recordToEntry } from './lib/mappers';
import type { MoodEntry } from './lib/types';

/**
 * Mood page-local state, exposed through three React contexts so
 * consumers re-render only on the slice they read.
 *
 *   - `MoodDataContext`    — `entries` / `load` / `availableYears`
 *     / `today`. The full set, ignoring filters ; used by Chart
 *     (heatmap), the SideColumn (donut + patterns) and the year
 *     selector.
 *   - `MoodFiltersContext` — `year` / `month` / `chartCollapsed`
 *     + setters, plus the derived `filtered` (entries inside
 *     the selected window). Bouge à chaque clic.
 *   - `MoodActionsContext` — `editEntry` / `deleteEntry`.
 *     Identity stays stable across data fetches via `entriesRef`,
 *     so leaves that only consume actions do not re-render when
 *     entries change.
 */

interface MoodDataValue {
  entries: ReadonlyArray<MoodEntry>;
  load: LoadState;
  /** Years with at least one entry, sorted descending. Falls back
   *  to `[currentYear]` so the YearSelector never renders blank. */
  availableYears: ReadonlyArray<number>;
  /** Reference « today » normalised to local midnight, captured
   *  once per provider mount. Drives `formatEntryLabel` and the
   *  heatmap's range. */
  today: Date;
}

interface MoodFiltersValue {
  year: number | null;
  month: number | null;
  chartCollapsed: boolean;
  /** Free-text search query. Filters across `comment`, `positive1..3`,
   *  `question`, `answer` (cf. issue #92). Combines with year/month
   *  via AND ; an empty string disables the filter. */
  searchQuery: string;
  /** Donut-driven score filter. `null` = show all scores. Clicking a
   *  segment of the SideColumn donut sets this ; clicking the same
   *  segment again clears it. Combines with year / month / search
   *  via AND. */
  scoreFilter: MoodScore | null;
  /** Heatmap-driven single-day filter. `null` = no day narrowing.
   *  Clicking a coloured cell of the frise sets this ; clicking the
   *  same cell again clears it. Mirrors Journal's same affordance. */
  dayFilter: string | null;

  /** Entries inside the selected year × month window AND matching
   *  the current `searchQuery` AND the active `scoreFilter`ANDthe
   *  active `dayFilter`. Mirrors the heatmap's `dataEnd` (not
   *  `end`), so the list and the frise agree. */
  filtered: ReadonlyArray<MoodEntry>;

  setYear: (next: number | null) => void;
  setMonth: (next: number | null) => void;
  setSearchQuery: (next: string) => void;
  setScoreFilter: (next: MoodScore | null) => void;
  setDayFilter: (next: string | null) => void;
  toggleChart: () => void;
}

interface MoodActionsValue {
  /** When `true`, `PrimaryColumn` renders `MoodForm` above the
   *  entries list. Driven by the create/edit affordances below. */
  formOpen: boolean;
  /** The entry being edited, or `null` for a fresh « create »
   *  flow. The form reads this to decide between insert / update
   *  + which initial values to seed. */
  editingEntry: MoodEntry | null;
  /** Open the inline form on a blank entry (topbar
   *  « + Nouvelle entrée » button). */
  openCreateForm: () => void;
  /** Open the inline form pre-filled with the given entry — the
   *  edit affordance on each row in the list. Kept as `editEntry`
   *  too (alias) so existing EntryRow markup compiles unchanged. */
  openEditForm: (entry: MoodEntry) => void;
  editEntry: (entry: MoodEntry) => void;
  /** Cancel / dismiss the form (the form's own Cancel button +
   *  post-save callback). */
  closeForm: () => void;
  deleteEntry: (entry: MoodEntry) => Promise<void>;
}

const {
  Provider: MoodContexts,
  useData: useMoodData,
  useFilters: useMoodFilters,
  useActions: useMoodActions,
} = createModuleContexts<MoodDataValue, MoodFiltersValue, MoodActionsValue>(
  'Mood',
);

// `MoodProvider` lives below — these hooks are bound by the
// factory above. Splitting would defeat the purpose of
// `createModuleContexts` (one source of truth per module).
 
// eslint-disable-next-line react-refresh/only-export-components
export { useMoodData, useMoodFilters, useMoodActions };

/* ---- Provider --------------------------------------------------- */

export function MoodProvider({ children }: { children: ReactNode }) {
  const { t, language } = useI18n();
  // ---- Pulled from the global store ----
  const ctx = useModuleClient('mood');
  const moodVersion = useNodeaStore((s) => s.moodVersion);

  // ---- Inline-form state (local to the Mood module ; no longer
  // routed through the global Zustand composer slice) ----
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);

  // ---- Data state ----
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  // ---- Filter state ----
  const [year, setYearState] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [chartCollapsed, setChartCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreFilter, setScoreFilter] = useState<MoodScore | null>(null);
  const [dayFilter, setDayFilter] = useState<string | null>(null);

  // Reference today, captured once at mount. The heatmap and the
  // entries-list filter both read it ; pinning it here avoids
  // every consumer building its own `new Date()` and disagreeing
  // by a few milliseconds (or worse, across a midnight tick).
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Ref keeps action callbacks stable across data fetches.
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Initial load (and re-load on bump).
  useEffect(() => {
    if (!ctx) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    const labels = {
      language,
      todayLabel: t('common.time.today'),
      yesterdayLabel: t('common.time.yesterday'),
    };
    moodClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((records) => {
        if (cancelled) return;
        const next = records
          .map((r) => recordToEntry(r, today, labels))
          // Newest first — the EntryRow list reads top-down.
          .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
        setEntries(next);
        setLoad({ status: 'ready' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : t('mood.context.loadFailed');
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, moodVersion, today, t, language]);

  // ---- Derived ----

  const availableYears = useMemo<ReadonlyArray<number>>(() => {
    const set = new Set<number>(
      entries.map((e) => Number(e.dateIso.slice(0, 4))),
    );
    if (set.size === 0) set.add(today.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [entries, today]);

  // Deferred search — keeps the input responsive while the filter
  // pass runs at deferred priority (audit 2026-06).
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filtered = useMemo<ReadonlyArray<MoodEntry>>(() => {
    const { start, dataEnd } = rangeFor(year, today);
    const startTime = start.getTime();
    const dataEndTime = dataEnd.getTime();
    const trimmedQuery = deferredSearchQuery.trim();
    return entries.filter((entry) => {
      // `entry.dateIso` is a bare YYYY-MM-DD string and `new Date(...)`
      // parses it as UTC midnight. The window bounds (`start`, `dataEnd`)
      // are LOCAL midnight via `setHours(0,0,0,0)`. In timezones east of
      // UTC, today's entry (e.g. local "2026-05-04") becomes
      // 02:00 LOCAL on May 4 once parsed as UTC, which compares strictly
      // greater than `today` and gets excluded from the rolling view.
      // Parsing the components directly into a local Date keeps both
      // sides on the same axis.
      const [yyyy, mm, dd] = entry.dateIso.split('-').map(Number);
      const d = new Date(yyyy ?? 0, (mm ?? 1) - 1, dd ?? 1);
      const t = d.getTime();
      if (t < startTime || t > dataEndTime) return false;
      if (month !== null && d.getMonth() !== month) return false;
      if (scoreFilter !== null && entry.score !== scoreFilter) return false;
      if (dayFilter !== null && entry.dateIso !== dayFilter) return false;
      // Cheap short-circuit when no search is active — avoids
      // running the normalisation pipeline on every entry.
      if (trimmedQuery.length === 0) return true;
      // Search across the textual payload fields. `positives` is
      // already an array — spreading is fine. Optional fields
      // (`comment`, `question`, `answer`) are filtered out by
      // `matchesAnyField` itself.
      return matchesAnyField(
        [
          ...entry.positives,
          entry.comment,
          entry.question,
          entry.answer,
        ],
        trimmedQuery,
      );
    });
  }, [entries, year, month, today, deferredSearchQuery, scoreFilter, dayFilter]);

  // ---- Filter setters ----

  // Reset month when switching years so a stale "Mars" filter
  // doesn't silently empty the list when jumping into a year
  // where that month has no entries yet.
  const setYear = useCallback((next: number | null) => {
    setYearState(next);
    setMonth(null);
  }, []);

  const toggleChart = useCallback(
    () => setChartCollapsed((prev) => !prev),
    [],
  );

  // ---- Actions ----

  // Opening the form auto-collapses the chart, closing it brings
  // it back. The frise is the biggest visual block on the page —
  // leaving it open while the inline form expands underneath
  // would push the form below the fold on every laptop. Tying the
  // two states together here keeps the « focus mode » predictable
  // without the user having to fold the chart manually first.
  const openCreateForm = useCallback(() => {
    setEditingEntry(null);
    setFormOpen(true);
    setChartCollapsed(true);
  }, []);

  const openEditForm = useCallback((entry: MoodEntry) => {
    setEditingEntry(entry);
    setFormOpen(true);
    setChartCollapsed(true);
  }, []);

  // Alias kept so EntryRow's existing `onClick={() => editEntry(entry)}`
  // compiles untouched. Internally it's the same as `openEditForm`.
  const editEntry = openEditForm;

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingEntry(null);
    setChartCollapsed(false);
  }, []);

  // FRONT-13 — per-entry mutation tracker so concurrent rollbacks
  // don't clobber each other. Each delete gets a unique token ; the
  // catch block only rolls back if its token is still the latest
  // for that entry id.
  const trackerRef = useRef(createMutationTracker<string>());

  const deleteEntry = useCallback(
    async (entry: MoodEntry) => {
      if (!ctx) return;
      if (!window.confirm(t('mood.context.confirmDelete', { values: { date: entry.date } })))
        return;
      const token = trackerRef.current.begin(entry.id);
      // Capture the original index so a rollback re-inserts at the
      // same position rather than at the end of the list.
      const indexBefore = entriesRef.current.findIndex((e) => e.id === entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        await moodClient.remove(ctx.moduleUserId, ctx.mainKey, entry.id);
        trackerRef.current.forget(entry.id);
        // Success : optimistic removal is the server state — no
        // refetch (audit 2026-06).
      } catch (err) {
        if (!trackerRef.current.isLatest(entry.id, token)) return;
        // Targeted rollback : re-insert THIS entry at its original
        // position. Snapshot-based rollback (the legacy pattern)
        // would have undone any concurrent unrelated mutations
        // landed in the meantime.
        setEntries((prev) => {
          if (prev.some((e) => e.id === entry.id)) return prev;
          const next = [...prev];
          const at = indexBefore < 0 || indexBefore > next.length ? next.length : indexBefore;
          next.splice(at, 0, entry);
          return next;
        });
        if (import.meta.env.DEV) console.warn('mood: delete failed', err);
      }
    },
    [ctx, t],
  );

  // ---- Memoised context values ----

  const dataValue = useMemo<MoodDataValue>(
    () => ({ entries, load, availableYears, today }),
    [entries, load, availableYears, today],
  );

  const filtersValue = useMemo<MoodFiltersValue>(
    () => ({
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
    }),
    [
      year,
      month,
      chartCollapsed,
      searchQuery,
      scoreFilter,
      dayFilter,
      filtered,
      setYear,
      toggleChart,
    ],
  );

  const actionsValue = useMemo<MoodActionsValue>(
    () => ({
      formOpen,
      editingEntry,
      openCreateForm,
      openEditForm,
      editEntry,
      closeForm,
      deleteEntry,
    }),
    [
      formOpen,
      editingEntry,
      openCreateForm,
      openEditForm,
      editEntry,
      closeForm,
      deleteEntry,
    ],
  );

  return (
    <MoodContexts data={dataValue} filters={filtersValue} actions={actionsValue}>
      {children}
    </MoodContexts>
  );
}
