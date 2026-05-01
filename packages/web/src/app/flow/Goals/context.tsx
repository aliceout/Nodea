import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { splitThreads } from '@nodea/shared';

import { goalsClient } from '@/core/api/modules/goals';
import { createModuleContexts } from '@/core/contexts/module-contexts';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { LoadState } from '@/core/types/load-state';

import { recordToEntry } from './lib/mappers';
import { byDateDesc } from './lib/sort';
import { nextStatus } from './lib/status';
import type { CanonicalStatus, GoalEntry, SortBy } from './lib/types';

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
 */

interface GoalsStats {
  total: number;
  open: number;
  wip: number;
  done: number;
}

interface GoalsDataValue {
  entries: ReadonlyArray<GoalEntry>;
  load: LoadState;
  stats: GoalsStats;
}

type GroupBy = 'thread' | 'year';

interface GoalsFiltersValue {
  statusFilter: CanonicalStatus | null;
  groupBy: GroupBy;
  search: string;
  sortBy: SortBy;
  hideDone: boolean;

  filtered: ReadonlyArray<GoalEntry>;
  groups: ReadonlyArray<readonly [string, GoalEntry[]]>;

  setStatusFilter: (next: CanonicalStatus | null) => void;
  setGroupBy: (next: GroupBy) => void;
  setSearch: (next: string) => void;
  setSortBy: (next: SortBy) => void;
  setHideDone: (next: boolean) => void;
}

interface GoalsActionsValue {
  carryOverOpen: boolean;
  cycleStatus: (entry: GoalEntry) => Promise<void>;
  editEntry: (entry: GoalEntry) => void;
  deleteEntry: (entry: GoalEntry) => Promise<void>;
  openCarryOver: () => void;
  closeCarryOver: () => void;
  /** Bulk-bump every unfinished goal whose date year matches `from`
   *  up to `to`. Status preserved (only open / wip ; done goals
   *  are filtered out before reaching this handler). Date format
   *  preserved (YYYY-MM stays YYYY-MM with the year swapped, bare
   *  YYYY stays bare). */
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
  // ---- Pulled from the global store ----
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['goals']?.moduleUserId ?? null;
  const goalsVersion = useNodeaStore((s) => s.goalsVersion);
  const bumpGoalsVersion = useNodeaStore((s) => s.bumpGoalsVersion);
  const openComposer = useNodeaStore((s) => s.openComposer);

  // ---- Data state ----
  const [entries, setEntries] = useState<GoalEntry[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  // ---- Filter state ----
  const [statusFilter, setStatusFilter] = useState<CanonicalStatus | null>(
    null,
  );
  const [groupBy, setGroupBy] = useState<GroupBy>('thread');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [hideDone, setHideDone] = useState(false);

  // ---- Transient UI state ----
  const [carryOverOpen, setCarryOverOpen] = useState(false);

  // Ref keeps action callbacks stable across fetches.
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Initial load (and re-load on bump).
  useEffect(() => {
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    goalsClient
      .list(moduleUserId, mainKey)
      .then((records) => {
        if (cancelled) return;
        const next = records.map(recordToEntry).sort(byDateDesc);
        setEntries(next);
        setLoad({ status: 'ready' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Erreur lors du chargement des objectifs.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId, goalsVersion]);

  // ---- Derived ----
  const stats = useMemo<GoalsStats>(
    () => ({
      total: entries.length,
      open: entries.filter((e) => e.status === 'open').length,
      wip: entries.filter((e) => e.status === 'wip').length,
      done: entries.filter((e) => e.status === 'done').length,
    }),
    [entries],
  );

  const filtered = useMemo<ReadonlyArray<GoalEntry>>(() => {
    const needle = search.trim().toLocaleLowerCase('fr');
    const out = entries.filter((e) => {
      // « Masquer les terminés » overrides nothing — when an
      // explicit status filter is `done`, the user clearly wants
      // to see them, so the hide toggle yields.
      if (hideDone && statusFilter !== 'done' && e.status === 'done') {
        return false;
      }
      if (statusFilter && e.status !== statusFilter) return false;
      if (needle.length > 0) {
        const haystack =
          `${e.title}\n${e.note}\n${e.thread}`.toLocaleLowerCase('fr');
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    // The fetch already returned date-desc ; stable sort keeps that
    // order whenever two entries tie on the active key (e.g. all
    // goals updated today fall back to date desc).
    out.sort((a, b) => {
      if (sortBy === 'alpha') {
        return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
      }
      if (sortBy === 'updated') {
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      return byDateDesc(a, b);
    });
    return out;
  }, [entries, statusFilter, search, sortBy, hideDone]);

  const groups = useMemo<ReadonlyArray<readonly [string, GoalEntry[]]>>(() => {
    const map = new Map<string, GoalEntry[]>();
    for (const entry of filtered) {
      const keys =
        groupBy === 'year'
          ? [entry.date.slice(0, 4) || '—']
          : (() => {
              const ts = splitThreads(entry.thread);
              return ts.length > 0 ? ts : ['— sans thread —'];
            })();
      for (const key of keys) {
        const bucket = map.get(key) ?? [];
        bucket.push(entry);
        map.set(key, bucket);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      b.localeCompare(a, 'fr', { numeric: true }),
    );
  }, [filtered, groupBy]);

  // ---- Actions ----

  const cycleStatus = useCallback(
    async (entry: GoalEntry) => {
      if (!mainKey || !moduleUserId) return;
      const next = nextStatus(entry.status);
      // Capture or clear `completed_at` whenever the status crosses
      // the `done` boundary. Going *into* done seeds a fresh
      // timestamp ; cycling out of done back to open clears it.
      // Re-entering done (after a clear) seeds a new timestamp —
      // we don't preserve the previous one because the old « date
      // de complétion » is no longer accurate.
      const nextCompletedAt =
        next === 'done'
          ? (entry.completedAt ?? new Date().toISOString())
          : null;
      const previous = entriesRef.current;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, status: next, completedAt: nextCompletedAt }
            : e,
        ),
      );
      try {
        await goalsClient.update(moduleUserId, mainKey, entry.id, {
          date: entry.date,
          title: entry.title,
          note: entry.note,
          status: next,
          thread: entry.thread,
          completed_at: nextCompletedAt,
          updated_at: new Date().toISOString(),
        });
        bumpGoalsVersion();
      } catch (err) {
        setEntries(previous);
        if (import.meta.env.DEV)
          console.warn('goals: toggle status failed', err);
      }
    },
    [mainKey, moduleUserId, bumpGoalsVersion],
  );

  const editEntry = useCallback(
    (entry: GoalEntry) => {
      openComposer('goal', {
        type: 'goal',
        id: entry.id,
        payload: {
          date: entry.date,
          title: entry.title,
          note: entry.note,
          status: entry.status,
          thread: entry.thread,
          completed_at: entry.completedAt,
          updated_at: entry.updatedAt,
        },
      });
    },
    [openComposer],
  );

  const deleteEntry = useCallback(
    async (entry: GoalEntry) => {
      if (!mainKey || !moduleUserId) return;
      if (!window.confirm(`Supprimer « ${entry.title} » ?`)) return;
      const previous = entriesRef.current;
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        await goalsClient.remove(moduleUserId, mainKey, entry.id);
        bumpGoalsVersion();
      } catch (err) {
        setEntries(previous);
        if (import.meta.env.DEV) console.warn('goals: delete failed', err);
      }
    },
    [mainKey, moduleUserId, bumpGoalsVersion],
  );

  const openCarryOver = useCallback(() => setCarryOverOpen(true), []);
  const closeCarryOver = useCallback(() => setCarryOverOpen(false), []);

  const carryOver = useCallback(
    async (from: number, to: number, affected: GoalEntry[]) => {
      if (!mainKey || !moduleUserId) return;
      if (affected.length === 0) {
        setCarryOverOpen(false);
        return;
      }
      const renumbered = new Map<string, string>();
      for (const e of affected) {
        const newDate = e.date
          ? e.date.replace(/^\d{4}/, String(to))
          : String(to);
        renumbered.set(e.id, newDate);
      }
      const previous = entriesRef.current;
      setEntries((prev) =>
        prev.map((e) =>
          renumbered.has(e.id) ? { ...e, date: renumbered.get(e.id)! } : e,
        ),
      );
      setCarryOverOpen(false);
      try {
        const now = new Date().toISOString();
        for (const e of affected) {
          const newDate = renumbered.get(e.id)!;
          await goalsClient.update(moduleUserId, mainKey, e.id, {
            date: newDate,
            title: e.title,
            note: e.note,
            status: e.status,
            thread: e.thread,
            completed_at: e.completedAt,
            updated_at: now,
          });
        }
        bumpGoalsVersion();
      } catch (err) {
        setEntries(previous);
        if (import.meta.env.DEV) console.warn('goals: carry-over failed', err);
      }
      // `from` is unused at runtime — used by the call site to
      // scope `affected`. Keep it in the signature so the contract
      // stays explicit.
      void from;
    },
    [mainKey, moduleUserId, bumpGoalsVersion],
  );

  // ---- Memoised context values ----

  const dataValue = useMemo<GoalsDataValue>(
    () => ({ entries, load, stats }),
    [entries, load, stats],
  );

  const filtersValue = useMemo<GoalsFiltersValue>(
    () => ({
      statusFilter,
      groupBy,
      search,
      sortBy,
      hideDone,
      filtered,
      groups,
      setStatusFilter,
      setGroupBy,
      setSearch,
      setSortBy,
      setHideDone,
    }),
    [statusFilter, groupBy, search, sortBy, hideDone, filtered, groups],
  );

  const actionsValue = useMemo<GoalsActionsValue>(
    () => ({
      carryOverOpen,
      cycleStatus,
      editEntry,
      deleteEntry,
      openCarryOver,
      closeCarryOver,
      carryOver,
    }),
    [
      carryOverOpen,
      cycleStatus,
      editEntry,
      deleteEntry,
      openCarryOver,
      closeCarryOver,
      carryOver,
    ],
  );

  return (
    <GoalsContexts data={dataValue} filters={filtersValue} actions={actionsValue}>
      {children}
    </GoalsContexts>
  );
}
