import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Context,
  type ReactNode,
} from 'react';

import { moodClient } from '@/core/api/modules/mood';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';

import { rangeFor } from './lib/date-format';
import { recordToEntry } from './lib/mappers';
import type { LoadState, MoodEntry } from './lib/types';

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

  /** Entries inside the selected year × month window. Mirrors the
   *  heatmap's `dataEnd` (not `end`), so the list and the frise
   *  agree. */
  filtered: ReadonlyArray<MoodEntry>;

  setYear: (next: number | null) => void;
  setMonth: (next: number | null) => void;
  toggleChart: () => void;
}

interface MoodActionsValue {
  editEntry: (entry: MoodEntry) => void;
  deleteEntry: (entry: MoodEntry) => Promise<void>;
}

const MoodDataContext = createContext<MoodDataValue | null>(null);
const MoodFiltersContext = createContext<MoodFiltersValue | null>(null);
const MoodActionsContext = createContext<MoodActionsValue | null>(null);

function useRequiredContext<T>(ctx: Context<T | null>, name: string): T {
  const v = useContext(ctx);
  if (!v) throw new Error(`${name}() must be used inside <MoodProvider>`);
  return v;
}

export function useMoodData(): MoodDataValue {
  return useRequiredContext(MoodDataContext, 'useMoodData');
}
export function useMoodFilters(): MoodFiltersValue {
  return useRequiredContext(MoodFiltersContext, 'useMoodFilters');
}
export function useMoodActions(): MoodActionsValue {
  return useRequiredContext(MoodActionsContext, 'useMoodActions');
}

/* ---- Provider --------------------------------------------------- */

export function MoodProvider({ children }: { children: ReactNode }) {
  // ---- Pulled from the global store ----
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['mood']?.moduleUserId ?? null;
  const moodVersion = useNodeaStore((s) => s.moodVersion);
  const bumpMoodVersion = useNodeaStore((s) => s.bumpMoodVersion);
  const openComposer = useNodeaStore((s) => s.openComposer);

  // ---- Data state ----
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  // ---- Filter state ----
  const [year, setYearState] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [chartCollapsed, setChartCollapsed] = useState(false);

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
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    moodClient
      .list(moduleUserId, mainKey)
      .then((records) => {
        if (cancelled) return;
        const next = records
          .map((r) => recordToEntry(r, today))
          // Newest first — the EntryRow list reads top-down.
          .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
        setEntries(next);
        setLoad({ status: 'ready', entries: next });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Erreur lors du chargement des entrées Mood.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId, moodVersion, today]);

  // ---- Derived ----

  const availableYears = useMemo<ReadonlyArray<number>>(() => {
    const set = new Set<number>(
      entries.map((e) => Number(e.dateIso.slice(0, 4))),
    );
    if (set.size === 0) set.add(today.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [entries, today]);

  const filtered = useMemo<ReadonlyArray<MoodEntry>>(() => {
    const { start, dataEnd } = rangeFor(year, today);
    const startTime = start.getTime();
    const dataEndTime = dataEnd.getTime();
    return entries.filter((entry) => {
      const d = new Date(entry.dateIso);
      const t = d.getTime();
      if (t < startTime || t > dataEndTime) return false;
      if (month !== null && d.getMonth() !== month) return false;
      return true;
    });
  }, [entries, year, month, today]);

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

  const editEntry = useCallback(
    (entry: MoodEntry) => {
      openComposer('mood', {
        type: 'mood',
        id: entry.id,
        payload: {
          date: entry.dateIso,
          mood_score: entry.score,
          mood_emoji: '',
          positive1: entry.positives[0],
          positive2: entry.positives[1],
          positive3: entry.positives[2],
          comment: entry.comment ?? '',
          ...(entry.question ? { question: entry.question } : {}),
          ...(entry.answer ? { answer: entry.answer } : {}),
        },
      });
    },
    [openComposer],
  );

  const deleteEntry = useCallback(
    async (entry: MoodEntry) => {
      if (!mainKey || !moduleUserId) return;
      if (!window.confirm(`Supprimer l’entrée du ${entry.date} ?`)) return;
      const previous = entriesRef.current;
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        await moodClient.remove(moduleUserId, mainKey, entry.id);
        bumpMoodVersion();
      } catch (err) {
        setEntries(previous);
        if (import.meta.env.DEV) console.warn('mood: delete failed', err);
      }
    },
    [mainKey, moduleUserId, bumpMoodVersion],
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
      filtered,
      setYear,
      setMonth,
      toggleChart,
    }),
    [year, month, chartCollapsed, filtered, setYear, toggleChart],
  );

  const actionsValue = useMemo<MoodActionsValue>(
    () => ({ editEntry, deleteEntry }),
    [editEntry, deleteEntry],
  );

  return (
    <MoodDataContext.Provider value={dataValue}>
      <MoodFiltersContext.Provider value={filtersValue}>
        <MoodActionsContext.Provider value={actionsValue}>
          {children}
        </MoodActionsContext.Provider>
      </MoodFiltersContext.Provider>
    </MoodDataContext.Provider>
  );
}
