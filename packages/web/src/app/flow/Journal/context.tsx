import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { splitThreads } from '@nodea/shared';

import { journalClient } from '@/core/api/modules/journal';
import { formatMonthLabel } from '@/core/i18n/date-format';
import { createModuleContexts } from '@/core/contexts/module-contexts';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import type { LoadState } from '@/core/types/load-state';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { matchesAnyField } from '@/lib/text-search';

import { recordToEntry } from './lib/mappers';
import { computeStats } from './lib/stats';
import {
  removeThreadFromString,
  renameThreadInString,
} from './lib/threads-mutate';
import type { JournalEntry, JournalStats } from './lib/types';

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

/**
 * Result of a bulk thread mutation (rename / merge / delete).
 * The action runs PATCHes in parallel ; this shape lets the
 * caller surface a precise « N réussis, M échoués » report
 * without re-reading the entries list.
 */
export interface ThreadMutationResult {
  updatedIds: ReadonlyArray<string>;
  failedIds: ReadonlyArray<string>;
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
  /**
   * Rename a thread across every entry that carries it (issue #57).
   * Optimistic local update + parallel PATCH ; the local state
   * for any failed entry reverts to its pre-update thread, so the
   * UI mirrors actual server state per-entry. The caller decides
   * how to surface partial failures. Renaming into a name that
   * already exists is a de facto merge — the helper dedups on
   * collision, which is intentional (drop the multi-select merge
   * bar after the audit pass).
   */
  renameThread: (from: string, to: string) => Promise<ThreadMutationResult>;
  /**
   * Drop a thread from every entry that carries it. Entries that
   * end up with an empty thread are left as such (sans-thread
   * bucket on the list page).
   */
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

// `JournalProvider` lives below — these hooks come from the
// factory above; splitting would defeat its purpose.
 
// eslint-disable-next-line react-refresh/only-export-components
export { useJournalData, useJournalFilters, useJournalActions };

/* ---- Provider --------------------------------------------------- */

export function JournalProvider({ children }: { children: ReactNode }) {
  const { t, language } = useI18n();
  // ---- Pulled from the global store ----
  const ctx = useModuleClient('journal');
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
    if (!ctx) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    const labels = {
      language,
      todayLabel: t('common.time.today'),
      yesterdayLabel: t('common.time.yesterday'),
    };
    journalClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((records) => {
        if (cancelled) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const next = records
          .map((r) => recordToEntry(r, today, labels))
          // Newest first.
          .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
        setEntries(next);
        setLoad({ status: 'ready' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : t('journal.context.loadFailed');
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, journalVersion, t, language]);

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
    const trimmedQuery = search.trim();
    return entries.filter((e) => {
      if (threadFilter && !splitThreads(e.thread).includes(threadFilter)) {
        return false;
      }
      // Cheap short-circuit when no search is active — avoids the
      // normalisation pipeline on every entry.
      if (trimmedQuery.length === 0) return true;
      // Search across title + content + thread. The thread inclusion
      // is intentional : users group entries by thread and often
      // search for « thérapie » expecting the thread to match.
      return matchesAnyField([e.title, e.content, e.thread], trimmedQuery);
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
          .map(([k, items]) => [formatMonthLabel(k, language), items] as const);
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
    [filtered, groupBy, language],
  );

  // ---- Actions ----

  const editEntry = useCallback(
    (entry: JournalEntry) => {
      openComposer('journal', {
        type: 'journal',
        id: entry.id,
        payload: {
          type: 'journal.entry',
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
      if (!ctx) return;
      const label = entry.title ?? entry.dateLabel;
      if (!window.confirm(t('journal.context.confirmDelete', { values: { label } })))
        return;
      const previous = entriesRef.current;
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        await journalClient.remove(ctx.moduleUserId, ctx.mainKey, entry.id);
        bumpJournalVersion();
      } catch (err) {
        setEntries(previous);
        if (import.meta.env.DEV) console.warn('journal: delete failed', err);
      }
    },
    [ctx, bumpJournalVersion, t],
  );

  const openReader = useCallback((id: string) => setReadingId(id), []);
  const closeReader = useCallback(() => setReadingId(null), []);

  /**
   * Apply a thread-string transform to every entry currently in
   * memory and PATCH each one whose thread actually changed. The
   * transform must be pure ; identity outputs are skipped (no
   * PATCH, no rerender).
   *
   * Strategy : optimistic local update + parallel PATCHes. Each
   * PATCH that fails reverts ITS entry's local thread back to the
   * pre-update value, so the local state never permanently
   * diverges from the server for a failed entry. Full transactional
   * rollback (revert the successful ones too) is out of scope here
   * — issue #57 noted the trade-off but the partial-failure path
   * is rare enough in practice that one retry from the manager is
   * a fine UX.
   */
  const applyThreadTransform = useCallback(
    async (
      transform: (raw: string) => string,
    ): Promise<ThreadMutationResult> => {
      if (!ctx) return { updatedIds: [], failedIds: [] };
      const affected: Array<{ entry: JournalEntry; nextThread: string }> = [];
      for (const entry of entriesRef.current) {
        const next = transform(entry.thread);
        if (next !== entry.thread) affected.push({ entry, nextThread: next });
      }
      if (affected.length === 0) return { updatedIds: [], failedIds: [] };

      // Snapshot the pre-update threads so each failed PATCH can
      // revert its own entry without cross-talk between concurrent
      // mutations on other entries.
      const snapshot = new Map(
        affected.map(({ entry }) => [entry.id, entry.thread]),
      );

      // Optimistic local update — flip every affected entry at once.
      setEntries((prev) =>
        prev.map((e) => {
          const change = affected.find((a) => a.entry.id === e.id);
          return change ? { ...e, thread: change.nextThread } : e;
        }),
      );

      const updatedIds: string[] = [];
      const failedIds: string[] = [];
      await Promise.all(
        affected.map(async ({ entry, nextThread }) => {
          try {
            await journalClient.update(ctx.moduleUserId, ctx.mainKey, entry.id, {
              type: 'journal.entry',
              date: entry.dateIso,
              thread: nextThread,
              title: entry.title,
              content: entry.content,
              attachments: entry.attachments,
            });
            updatedIds.push(entry.id);
          } catch (err) {
            failedIds.push(entry.id);
            // Revert this entry's optimistic thread back to its
            // pre-update value. Other entries keep their state ;
            // a concurrent successful PATCH on a different entry
            // isn't undone.
            const previous = snapshot.get(entry.id);
            if (previous !== undefined) {
              setEntries((prev) =>
                prev.map((e) =>
                  e.id === entry.id ? { ...e, thread: previous } : e,
                ),
              );
            }
            if (import.meta.env.DEV)
              console.warn('journal: thread mutation failed', err);
          }
        }),
      );

      if (updatedIds.length > 0) bumpJournalVersion();
      return { updatedIds, failedIds };
    },
    [ctx, bumpJournalVersion],
  );

  const renameThread = useCallback(
    (from: string, to: string) =>
      applyThreadTransform((raw) => renameThreadInString(raw, from, to)),
    [applyThreadTransform],
  );

  const deleteThread = useCallback(
    (target: string) =>
      applyThreadTransform((raw) => removeThreadFromString(raw, target)),
    [applyThreadTransform],
  );

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
      renameThread,
      deleteThread,
    }),
    [
      readingId,
      editEntry,
      deleteEntry,
      openReader,
      closeReader,
      renameThread,
      deleteThread,
    ],
  );

  return (
    <JournalContexts data={dataValue} filters={filtersValue} actions={actionsValue}>
      {children}
    </JournalContexts>
  );
}
