import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { splitThreads } from '@nodea/shared';
import type { JournalPayload } from '@nodea/shared';

import { journalClient } from '@/core/api/modules/journal';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { formatMonthLabel } from '@/core/i18n/date-format';
import { createModuleContexts } from '@/core/contexts/module-contexts';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import type { LoadState } from '@/core/types/load-state';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useConfirm } from '@/ui/dirk/confirm/confirm-context';
import { matchesHaystack } from '@/lib/text-search';

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
  /** Years present in the dataset, descending. Drives the
   *  `YearSelector` tab strip in the primary column (issue #56,
   *  mirrors Mood's `availableYears`). */
  availableYears: ReadonlyArray<number>;
}

interface JournalFiltersValue {
  threadFilter: string | null;
  groupBy: GroupBy;
  search: string;
  /** Year filter (issue #56). `null` = « En cours » (rolling 52
   *  weeks ending today, no list-side filtering). A number = list
   *  + heatmap focused on that calendar year. */
  year: number | null;
  /** Single-day focus filter (issue #56) — set when the user clicks
   *  a heatmap cell. ISO `YYYY-MM-DD` ; null = no day focus. The
   *  filter applies on top of the other filters in `filtered`. */
  dayFilter: string | null;
  /** Chart collapse state (issue #56). When true, the heatmap is
   *  hidden ; the chevron toggle re-opens it. */
  chartCollapsed: boolean;

  threads: ReadonlyArray<string>;
  filtered: ReadonlyArray<JournalEntry>;
  groups: ReadonlyArray<readonly [string, JournalEntry[]]>;

  setThreadFilter: (next: string | null) => void;
  setGroupBy: (next: GroupBy) => void;
  setSearch: (next: string) => void;
  setYear: (next: number | null) => void;
  setDayFilter: (next: string | null) => void;
  toggleChart: () => void;
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
  /** Inline composer state. `formOpen` toggles the form's visibility
   *  in `PrimaryColumn` ; `editingEntry` is the entry being edited
   *  (or `null` on a fresh create). Mirrors the Mood / Goals posture
   *  — `openComposer` from the global Zustand slice is no longer
   *  used by Journal. */
  formOpen: boolean;
  editingEntry: JournalEntry | null;
  openCreateForm: () => void;
  openEditForm: (entry: JournalEntry) => void;
  closeForm: () => void;
  editEntry: (entry: JournalEntry) => void;
  deleteEntry: (entry: JournalEntry) => Promise<void>;
  /** Insert-or-replace a single record locally after a form save —
   *  the inline composer calls this with the record returned by
   *  `journalClient.create` / `.update` instead of bumping the version
   *  and forcing a full collection refetch (audit 2026-06 passe 2). */
  upsertRecord: (record: DecryptedRecord<JournalPayload>) => void;
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
  const confirm = useConfirm();
  // ---- Pulled from the global store ----
  const ctx = useModuleClient('journal');
  const journalVersion = useNodeaStore((s) => s.journalVersion);
  const bumpJournalVersion = useNodeaStore((s) => s.bumpJournalVersion);

  // ---- Data state ----
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  // ---- Filter state ----
  const [threadFilter, setThreadFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('thread');
  const [year, setYear] = useState<number | null>(null);
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  // Heatmap starts collapsed (issue #56 follow-up) — Journal is
  // primarily a writing surface ; the year-density overview is a
  // « step back » affordance the user opts into when they want
  // it, not the default landing.
  const [chartCollapsed, setChartCollapsed] = useState(true);
  const toggleChart = useCallback(
    () => setChartCollapsed((prev) => !prev),
    [],
  );

  // ---- Reader UI state ----
  const [readingId, setReadingId] = useState<string | null>(null);

  // ---- Inline composer state ----
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

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

  const availableYears = useMemo<ReadonlyArray<number>>(() => {
    const set = new Set<number>();
    for (const e of entries) {
      const y = parseInt(e.dateIso.slice(0, 4), 10);
      if (Number.isFinite(y)) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [entries]);

  // `useDeferredValue` keeps the search input responsive : the
  // filter + regroup pass over N entries runs at deferred priority
  // instead of synchronously inside the keystroke's render (audit
  // 2026-06).
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo<ReadonlyArray<JournalEntry>>(() => {
    const trimmedQuery = deferredSearch.trim();
    return entries.filter((e) => {
      if (threadFilter && !splitThreads(e.thread).includes(threadFilter)) {
        return false;
      }
      // Year filter (issue #56). null = « En cours » = no year
      // narrowing on the list (the heatmap still shows the rolling
      // 52 weeks). When a year is picked, the list collapses to
      // that calendar year.
      if (year !== null && e.dateIso.slice(0, 4) !== String(year)) {
        return false;
      }
      // Single-day focus filter (issue #56) — clicking a heatmap
      // cell drops everything except that day's entries.
      if (dayFilter && e.dateIso.slice(0, 10) !== dayFilter) {
        return false;
      }
      // Cheap short-circuit when no search is active — avoids the
      // normalisation pipeline on every entry.
      if (trimmedQuery.length === 0) return true;
      // Search across title + content + thread via the precomputed
      // haystack (built once in `recordToEntry`). The thread inclusion
      // is intentional : users group entries by thread and often
      // search for « thérapie » expecting the thread to match.
      return matchesHaystack(e.searchHaystack, trimmedQuery);
    });
  }, [entries, threadFilter, year, dayFilter, deferredSearch]);

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
      // The « no thread » bucket reuses the list's display label —
      // the key doubles as the rendered group header.
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
    },
    [filtered, groupBy, language, t],
  );

  // ---- Actions ----

  // Inline form lifecycle. Opening the form auto-collapses the
  // heatmap so the writing surface gets the full width — same UX
  // posture as Mood's chart collapse. Closing the form re-opens
  // the heatmap if the user had it expanded ; we restore it to
  // « collapsed » by default (the natural Journal landing state).
  const openCreateForm = useCallback(() => {
    setEditingEntry(null);
    setFormOpen(true);
    setChartCollapsed(true);
  }, []);

  const openEditForm = useCallback((entry: JournalEntry) => {
    setEditingEntry(entry);
    setFormOpen(true);
    setChartCollapsed(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingEntry(null);
  }, []);

  // Public action — kept for the row's « pencil » affordance and
  // for the reader's edit button. Same call site as before but now
  // surfaces the inline form instead of the global Composer.
  const editEntry = openEditForm;

  const deleteEntry = useCallback(
    async (entry: JournalEntry) => {
      if (!ctx) return;
      const label = entry.title ?? entry.dateLabel;
      const ok = await confirm({
        message: t('journal.context.confirmDelete', { values: { label } }),
        tone: 'danger',
      });
      if (!ok) return;
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        await journalClient.remove(ctx.moduleUserId, ctx.mainKey, entry.id);
        // Success : the optimistic removal IS the server state — the
        // old `bumpJournalVersion()` re-downloaded + re-decrypted the
        // whole collection (attachments included) right after it
        // (audit 2026-06).
      } catch (err) {
        // Targeted rollback : re-insert THIS entry only, instead of
        // restoring a full-list snapshot that would undo concurrent
        // mutations. The list re-sorts on render is not needed —
        // entries state is kept newest-first, so re-insert sorted.
        setEntries((prev) => {
          const next = [...prev, entry];
          next.sort((a, b) => b.dateIso.localeCompare(a.dateIso));
          return next;
        });
        if (import.meta.env.DEV) console.warn('journal: delete failed', err);
      }
    },
    [ctx, t, confirm],
  );

  const upsertRecord = useCallback(
    (record: DecryptedRecord<JournalPayload>) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const labels = {
        language,
        todayLabel: t('common.time.today'),
        yesterdayLabel: t('common.time.yesterday'),
      };
      const entry = recordToEntry(record, today, labels);
      setEntries((prev) => {
        const without = prev.filter((e) => e.id !== entry.id);
        const next = [entry, ...without];
        next.sort((a, b) => b.dateIso.localeCompare(a.dateIso));
        return next;
      });
    },
    [language, t],
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
    () => ({ entries, load, stats, availableYears }),
    [entries, load, stats, availableYears],
  );

  const filtersValue = useMemo<JournalFiltersValue>(
    () => ({
      threadFilter,
      groupBy,
      search,
      year,
      dayFilter,
      chartCollapsed,
      threads,
      filtered,
      groups,
      setThreadFilter,
      setGroupBy,
      setSearch,
      setYear,
      setDayFilter,
      toggleChart,
    }),
    [
      threadFilter,
      groupBy,
      search,
      year,
      dayFilter,
      chartCollapsed,
      threads,
      filtered,
      groups,
      toggleChart,
    ],
  );

  const actionsValue = useMemo<JournalActionsValue>(
    () => ({
      readingId,
      formOpen,
      editingEntry,
      openCreateForm,
      openEditForm,
      closeForm,
      editEntry,
      deleteEntry,
      upsertRecord,
      openReader,
      closeReader,
      renameThread,
      deleteThread,
    }),
    [
      readingId,
      formOpen,
      editingEntry,
      openCreateForm,
      openEditForm,
      closeForm,
      editEntry,
      deleteEntry,
      upsertRecord,
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
