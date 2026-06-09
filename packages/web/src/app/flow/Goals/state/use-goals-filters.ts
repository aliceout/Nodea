/**
 * Goals filters hook (REFACTO-08).
 *
 * Owns the raw filter state (statusFilter / groupBy / search / sortBy
 * / hideDone), derives `filtered` and `groups` from the entries the
 * provider passes in.
 *
 * Not a React context — the provider in `../context.tsx` consumes
 * this hook and republishes via `GoalsFiltersValue`.
 */
import { useDeferredValue, useMemo, useState } from 'react';
import { splitThreads } from '@nodea/shared';

import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import { byDateDesc } from '../lib/sort';
import type { CanonicalStatus, GoalEntry, SortBy } from '../lib/types';

export type GoalsGroupBy = 'thread' | 'year';

/** The two presentation modes the Goals primary surface can take.
 *  Synced to the encrypted preferences blob (same posture as
 *  `libraryViewMode`) so the choice follows the user across
 *  devices instead of leaking through localStorage. */
export const GOALS_VIEW_MODES = ['list', 'cards'] as const;
export type GoalsViewMode = (typeof GOALS_VIEW_MODES)[number];

const DEFAULT_VIEW_MODE: GoalsViewMode = 'list';

export interface GoalsFiltersState {
  statusFilter: CanonicalStatus | null;
  groupBy: GoalsGroupBy;
  viewMode: GoalsViewMode;
  search: string;
  sortBy: SortBy;
  hideDone: boolean;
  /** Active thread filter ; `null` means all threads. Mirrors the
   *  Journal SideColumn UX — the chip list is rendered next to the
   *  groupBy toggle when `groupBy === 'thread'`. Composes with
   *  search / status / hide-done via AND. */
  threadFilter: string | null;

  filtered: ReadonlyArray<GoalEntry>;
  groups: ReadonlyArray<readonly [string, GoalEntry[]]>;
  /** Deduped sorted list of every thread that appears on at least
   *  one goal. Drives the SideColumn chip list. */
  threads: ReadonlyArray<string>;

  setStatusFilter: (next: CanonicalStatus | null) => void;
  setGroupBy: (next: GoalsGroupBy) => void;
  setViewMode: (next: GoalsViewMode) => void;
  setSearch: (next: string) => void;
  setSortBy: (next: SortBy) => void;
  setHideDone: (next: boolean) => void;
  setThreadFilter: (next: string | null) => void;
}

export function useGoalsFilters(entries: GoalEntry[]): GoalsFiltersState {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<CanonicalStatus | null>(
    null,
  );
  const [groupBy, setGroupBy] = useState<GoalsGroupBy>('thread');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [hideDone, setHideDone] = useState(false);
  const [threadFilter, setThreadFilter] = useState<string | null>(null);

  // viewMode persistence (encrypted preferences blob — same posture
  // as `libraryViewMode`). Clamps unknown stored values to the
  // default so a future client version that adds a third mode
  // can't paint this version into a bad layout.
  const { preferences, setPreferences } = usePreferences();
  const persistedViewMode =
    preferences.goalsViewMode &&
    (GOALS_VIEW_MODES as readonly string[]).includes(preferences.goalsViewMode)
      ? (preferences.goalsViewMode as GoalsViewMode)
      : DEFAULT_VIEW_MODE;
  const setViewMode = (next: GoalsViewMode): void => {
    if (next === persistedViewMode) return;
    void setPreferences({ goalsViewMode: next });
  };
  const viewMode = persistedViewMode;

  // Deduped sorted thread inventory — same shape Journal exposes
  // for its sidebar chips. FR collation so accented threads sort
  // naturally next to their ASCII neighbours.
  const threads = useMemo<ReadonlyArray<string>>(() => {
    const set = new Set<string>();
    for (const e of entries) {
      for (const tag of splitThreads(e.thread)) set.add(tag);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [entries]);

  // Deferred search — keeps the input responsive while the filter +
  // sort pass runs at deferred priority (audit 2026-06).
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo<ReadonlyArray<GoalEntry>>(() => {
    const needle = deferredSearch.trim().toLocaleLowerCase('fr');
    const out = entries.filter((e) => {
      // « Masquer les terminés » overrides nothing — when an
      // explicit status filter is `done`, the user clearly wants
      // to see them, so the hide toggle yields.
      if (hideDone && statusFilter !== 'done' && e.status === 'done') {
        return false;
      }
      if (statusFilter && e.status !== statusFilter) return false;
      if (threadFilter && !splitThreads(e.thread).includes(threadFilter)) {
        return false;
      }
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
  }, [entries, statusFilter, threadFilter, deferredSearch, sortBy, hideDone]);

  const groups = useMemo<ReadonlyArray<readonly [string, GoalEntry[]]>>(() => {
    const map = new Map<string, GoalEntry[]>();
    // Same label the reader's eyebrow uses for thread-less goals —
    // the bucket key doubles as the rendered group header.
    const noThreadLabel = t('goals.reader.noThreadEyebrow');
    for (const entry of filtered) {
      const keys =
        groupBy === 'year'
          ? [entry.date.slice(0, 4) || '—']
          : (() => {
              const ts = splitThreads(entry.thread);
              return ts.length > 0 ? ts : [noThreadLabel];
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
  }, [filtered, groupBy, t]);

  return {
    statusFilter,
    groupBy,
    viewMode,
    search,
    sortBy,
    hideDone,
    threadFilter,
    filtered,
    groups,
    threads,
    setStatusFilter,
    setGroupBy,
    setViewMode,
    setSearch,
    setSortBy,
    setHideDone,
    setThreadFilter,
  };
}
