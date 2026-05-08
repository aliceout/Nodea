/**
 * Library filters hook (REFACTO-08).
 *
 * Owns the raw filter state (status / tag / group-by / view mode /
 * cell filter), derives `allTags` / `filteredItems` / `groups` from
 * the data the provider passes in, and persists `viewMode` to
 * localStorage so the user's catalogue rendering choice survives a
 * reload.
 *
 * Not a React context — the provider in `../context.tsx` consumes
 * this hook and republishes via `LibraryFiltersValue`. Splitting it
 * out keeps the filter logic reviewable in isolation.
 */
import { useEffect, useMemo, useState } from 'react';
import { type LibraryStatus } from '@nodea/shared';

import { matchesAnyField } from '@/lib/text-search';

import { matchesCellFilter, type CellFilter } from '../lib/cell-filter';
import { buildGroups, type LibraryGroupBy } from '../lib/grouping';
import type { LibraryGroup, LibraryItem } from '../lib/types';

/** The five catalogue rendering modes. Persisted to localStorage so
 *  the user's choice sticks across sessions on the same device.
 *  Not synced to the encrypted preferences blob — local UI decision,
 *  the cross-device hop isn't worth the wiring. */
export const LIBRARY_VIEW_MODES = [
  'list-plain',
  'list-cover',
  'table',
  'grid',
  'wall',
] as const;
export type LibraryViewMode = (typeof LIBRARY_VIEW_MODES)[number];

const VIEW_MODE_STORAGE_KEY = 'nodea:library:viewMode';

function readViewMode(): LibraryViewMode {
  if (typeof window === 'undefined') return 'list-plain';
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (stored && (LIBRARY_VIEW_MODES as readonly string[]).includes(stored)) {
    return stored as LibraryViewMode;
  }
  return 'list-plain';
}

export interface LibraryFiltersState {
  statusFilter: LibraryStatus | 'all' | 'favorites';
  tagFilter: string | null;
  groupBy: LibraryGroupBy;
  viewMode: LibraryViewMode;
  cellFilter: CellFilter | null;
  /** Free-text search query. Filters across `title`,
   *  `creators[].name`, and `tags[]` (cf. issue #94). Combines with
   *  the chip filters via AND ; an empty string disables the
   *  filter. */
  searchQuery: string;

  allTags: string[];
  filteredItems: LibraryItem[];
  groups: LibraryGroup[];

  setStatusFilter: (next: LibraryStatus | 'all' | 'favorites') => void;
  setTagFilter: (next: string | null) => void;
  setGroupBy: (next: LibraryGroupBy) => void;
  setViewMode: (next: LibraryViewMode) => void;
  setCellFilter: (next: CellFilter | null) => void;
  setSearchQuery: (next: string) => void;
}

export function useLibraryFilters(items: LibraryItem[]): LibraryFiltersState {
  const [statusFilter, setStatusFilter] =
    useState<LibraryStatus | 'all' | 'favorites'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<LibraryGroupBy>('status');
  const [cellFilter, setCellFilter] = useState<CellFilter | null>(null);
  const [viewMode, setViewMode] = useState<LibraryViewMode>(() => readViewMode());
  const [searchQuery, setSearchQuery] = useState('');

  // viewMode persistence (localStorage).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const allTags = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const it of items) for (const t of it.tags ?? []) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [items]);

  const filteredItems = useMemo<LibraryItem[]>(() => {
    const trimmedQuery = searchQuery.trim();
    return items.filter((it) => {
      if (statusFilter === 'favorites') {
        if (!it.isFavorite) return false;
      } else if (statusFilter !== 'all' && it.status !== statusFilter) {
        return false;
      }
      if (tagFilter && !(it.tags ?? []).includes(tagFilter)) return false;
      if (cellFilter && !matchesCellFilter(it, cellFilter)) return false;
      // Cheap short-circuit when no search is active.
      if (trimmedQuery.length === 0) return true;
      // Search across title + every creator name + every tag. The
      // creator-list spread keeps multi-author works (« Hugo &
      // Sand ») searchable on either side.
      return matchesAnyField(
        [it.title, ...it.creators.map((c) => c.name), ...(it.tags ?? [])],
        trimmedQuery,
      );
    });
  }, [items, statusFilter, tagFilter, cellFilter, searchQuery]);

  const groups = useMemo<LibraryGroup[]>(
    () => buildGroups(filteredItems, groupBy),
    [filteredItems, groupBy],
  );

  return {
    statusFilter,
    tagFilter,
    groupBy,
    viewMode,
    cellFilter,
    searchQuery,
    allTags,
    filteredItems,
    groups,
    setStatusFilter,
    setTagFilter,
    setGroupBy,
    setViewMode,
    setCellFilter,
    setSearchQuery,
  };
}
