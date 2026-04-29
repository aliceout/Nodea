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
import { splitThreads } from '@nodea/shared';

import { passageClient } from '@/core/api/modules/passage';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';

import { formatMonthLabel } from './lib/date-format';
import { recordToEntry } from './lib/mappers';
import { computeStats } from './lib/stats';
import type { JournalEntry, JournalStats, LoadState } from './lib/types';

/**
 * Journal page-local state, exposed through three React contexts so
 * consumers re-render only on the slice they read.
 *
 *   - `JournalDataContext`    — `entries` / `load` / `stats`
 *     (the « Stats » block always counts the full set, ignoring
 *     filters).
 *   - `JournalFiltersContext` — `threadFilter` / `groupBy` /
 *     `search` + setters, plus the derived `threads` / `filtered`
 *     / `groups`.
 *   - `JournalActionsContext` — `editEntry` / `deleteEntry`, the
 *     reader UI state (`readingId`), and `openReader` /
 *     `closeReader`. Callbacks are `useCallback` and read live
 *     data via `entriesRef` for rollback snapshots — identity
 *     stays stable across data fetches.
 *
 * The reader's prev/next navigation walks the **filtered** list
 * (search + thread filter applied), so reader leaves consume both
 * the filters and the actions contexts and compute the next id at
 * the call site.
 */

type GroupBy = 'thread' | 'month';

interface JournalDataValue {
  entries: ReadonlyArray<JournalEntry>;
  load: LoadState;
  stats: JournalStats;
}

interface JournalFiltersValue {
  threadFilter: string | null;
  groupBy: GroupBy;
  search: string;

  threads: ReadonlyArray<string>;
  filtered: ReadonlyArray<JournalEntry>;
  groups: ReadonlyArray<readonly [string, JournalEntry[]]>;

  setThreadFilter: (next: string | null) => void;
  setGroupBy: (next: GroupBy) => void;
  setSearch: (next: string) => void;
}

interface JournalActionsValue {
  /** Id of the entry currently shown in the focus reader, or null
   *  when the regular list view is active. Stored as id rather
   *  than index so the reader survives a refetch that reorders
   *  entries. */
  readingId: string | null;
  editEntry: (entry: JournalEntry) => void;
  deleteEntry: (entry: JournalEntry) => Promise<void>;
  openReader: (id: string) => void;
  closeReader: () => void;
}

const JournalDataContext = createContext<JournalDataValue | null>(null);
const JournalFiltersContext = createContext<JournalFiltersValue | null>(null);
const JournalActionsContext = createContext<JournalActionsValue | null>(null);

function useRequiredContext<T>(ctx: Context<T | null>, name: string): T {
  const v = useContext(ctx);
  if (!v) throw new Error(`${name}() must be used inside <JournalProvider>`);
  return v;
}

export function useJournalData(): JournalDataValue {
  return useRequiredContext(JournalDataContext, 'useJournalData');
}
export function useJournalFilters(): JournalFiltersValue {
  return useRequiredContext(JournalFiltersContext, 'useJournalFilters');
}
export function useJournalActions(): JournalActionsValue {
  return useRequiredContext(JournalActionsContext, 'useJournalActions');
}

/* ---- Provider --------------------------------------------------- */

export function JournalProvider({ children }: { children: ReactNode }) {
  // ---- Pulled from the global store ----
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['journal']?.moduleUserId ?? null;
  const journalVersion = useNodeaStore((s) => s.journalVersion);
  const bumpJournalVersion = useNodeaStore((s) => s.bumpJournalVersion);
  const openComposer = useNodeaStore((s) => s.openComposer);

  // ---- Data state ----
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  // ---- Filter state ----
  const [threadFilter, setThreadFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('thread');

  // ---- Reader UI state ----
  const [readingId, setReadingId] = useState<string | null>(null);

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
    passageClient
      .list(moduleUserId, mainKey)
      .then((records) => {
        if (cancelled) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const next = records
          .map((r) => recordToEntry(r, today))
          // Newest first.
          .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
        setEntries(next);
        setLoad({ status: 'ready' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Erreur lors du chargement du journal.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId, journalVersion]);

  // ---- Derived ----
  const stats = useMemo<JournalStats>(() => computeStats(entries), [entries]);

  const threads = useMemo<ReadonlyArray<string>>(() => {
    const set = new Set<string>();
    for (const e of entries) {
      for (const t of splitThreads(e.thread)) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [entries]);

  const filtered = useMemo<ReadonlyArray<JournalEntry>>(() => {
    const needle = search.trim().toLocaleLowerCase('fr');
    return entries.filter((e) => {
      if (threadFilter && !splitThreads(e.thread).includes(threadFilter)) {
        return false;
      }
      if (needle.length > 0) {
        const haystack = `${e.title ?? ''}\n${e.content}`.toLocaleLowerCase('fr');
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [entries, threadFilter, search]);

  const groups = useMemo<ReadonlyArray<readonly [string, JournalEntry[]]>>(
    () => {
      const map = new Map<string, JournalEntry[]>();
      if (groupBy === 'month') {
        // Group by year/month derived from the entry's ISO date ;
        // descending so the freshest month sits on top. The bucket
        // key stays raw `YYYY-MM` for sort stability ; we
        // translate to « mars 2026 » only on the way out.
        for (const entry of filtered) {
          const key = entry.dateIso.slice(0, 7);
          const bucket = map.get(key) ?? [];
          bucket.push(entry);
          map.set(key, bucket);
        }
        return Array.from(map.entries())
          .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
          .map(([k, items]) => [formatMonthLabel(k), items] as const);
      }
      // Default : group by thread (multi-thread entries land in
      // each of their thread buckets — same convention as Goals).
      for (const entry of filtered) {
        const keys = splitThreads(entry.thread);
        const list = keys.length > 0 ? keys : ['— sans thread —'];
        for (const key of list) {
          const bucket = map.get(key) ?? [];
          bucket.push(entry);
          map.set(key, bucket);
        }
      }
      return Array.from(map.entries()).sort(([a], [b]) =>
        a.localeCompare(b, 'fr'),
      );
    },
    [filtered, groupBy],
  );

  // ---- Actions ----

  const editEntry = useCallback(
    (entry: JournalEntry) => {
      openComposer('journal', {
        type: 'journal',
        id: entry.id,
        payload: {
          type: 'passage.entry',
          date: entry.dateIso,
          thread: entry.thread,
          title: entry.title,
          content: entry.content,
          attachments: entry.attachments,
        },
      });
    },
    [openComposer],
  );

  const deleteEntry = useCallback(
    async (entry: JournalEntry) => {
      if (!mainKey || !moduleUserId) return;
      const label = entry.title ?? entry.dateLabel;
      if (!window.confirm(`Supprimer « ${label} » ?`)) return;
      const previous = entriesRef.current;
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        await passageClient.remove(moduleUserId, mainKey, entry.id);
        bumpJournalVersion();
      } catch (err) {
        setEntries(previous);
        if (import.meta.env.DEV) console.warn('journal: delete failed', err);
      }
    },
    [mainKey, moduleUserId, bumpJournalVersion],
  );

  const openReader = useCallback((id: string) => setReadingId(id), []);
  const closeReader = useCallback(() => setReadingId(null), []);

  // ---- Memoised context values ----

  const dataValue = useMemo<JournalDataValue>(
    () => ({ entries, load, stats }),
    [entries, load, stats],
  );

  const filtersValue = useMemo<JournalFiltersValue>(
    () => ({
      threadFilter,
      groupBy,
      search,
      threads,
      filtered,
      groups,
      setThreadFilter,
      setGroupBy,
      setSearch,
    }),
    [threadFilter, groupBy, search, threads, filtered, groups],
  );

  const actionsValue = useMemo<JournalActionsValue>(
    () => ({
      readingId,
      editEntry,
      deleteEntry,
      openReader,
      closeReader,
    }),
    [readingId, editEntry, deleteEntry, openReader, closeReader],
  );

  return (
    <JournalDataContext.Provider value={dataValue}>
      <JournalFiltersContext.Provider value={filtersValue}>
        <JournalActionsContext.Provider value={actionsValue}>
          {children}
        </JournalActionsContext.Provider>
      </JournalFiltersContext.Provider>
    </JournalDataContext.Provider>
  );
}
