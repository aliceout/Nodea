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
import { useMemo, useState } from 'react';
import { splitThreads } from '@nodea/shared';

import { byDateDesc } from '../lib/sort';
import type { CanonicalStatus, GoalEntry, SortBy } from '../lib/types';

export type GoalsGroupBy = 'thread' | 'year';

export interface GoalsFiltersState {
  statusFilter: CanonicalStatus | null;
  groupBy: GoalsGroupBy;
  search: string;
  sortBy: SortBy;
  hideDone: boolean;

  filtered: ReadonlyArray<GoalEntry>;
  groups: ReadonlyArray<readonly [string, GoalEntry[]]>;

  setStatusFilter: (next: CanonicalStatus | null) => void;
  setGroupBy: (next: GoalsGroupBy) => void;
  setSearch: (next: string) => void;
  setSortBy: (next: SortBy) => void;
  setHideDone: (next: boolean) => void;
}

export function useGoalsFilters(entries: GoalEntry[]): GoalsFiltersState {
  const [statusFilter, setStatusFilter] = useState<CanonicalStatus | null>(
    null,
  );
  const [groupBy, setGroupBy] = useState<GoalsGroupBy>('thread');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [hideDone, setHideDone] = useState(false);

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

  return {
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
  };
}
