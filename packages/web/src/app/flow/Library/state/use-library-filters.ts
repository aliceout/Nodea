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
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { type LibraryStatus } from '@nodea/shared';

import { usePreferences } from '@/core/auth/use-preferences';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { matchesAnyField } from '@/lib/text-search';

import { matchesCellFilter, type CellFilter } from '../lib/cell-filter';
import { buildGroups, type LibraryGroupBy } from '../lib/grouping';
import type { LibraryGroup, LibraryItem } from '../lib/types';

/** The five catalogue rendering modes. Synced to the encrypted
 *  preferences blob (audit v2.8.0) — the previous
 *  `nodea:library:viewMode` localStorage key revealed « this user
 *  has been using Library » to anyone with browser-storage access
 *  on the same machine. Side effect : the chosen layout now
 *  follows the user across browsers.
 *
 *  Default `list-plain` applies whenever the preferences blob hasn't
 *  yet loaded (the few hundred milliseconds between login and the
 *  main-key derivation) ; the UI then re-renders into the user's
 *  pinned choice once the blob arrives. */
export const LIBRARY_VIEW_MODES = [
  'list-plain',
  'list-cover',
  'table',
  'grid',
  'wall',
] as const;
export type LibraryViewMode = (typeof LIBRARY_VIEW_MODES)[number];

const DEFAULT_VIEW_MODE: LibraryViewMode = 'list-plain';

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
  // `t` feeds the group headers built by `buildGroups` (status names,
  // « no value » buckets). Listed in the memo deps so a language
  // switch re-labels the groups without a data refetch.
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] =
    useState<LibraryStatus | 'all' | 'favorites'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<LibraryGroupBy>('status');
  const [cellFilter, setCellFilter] = useState<CellFilter | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // viewMode persistence (encrypted preferences blob — audit v2.8.0).
  // Read the current persisted choice from the preferences slice ;
  // fall back to DEFAULT_VIEW_MODE while the blob hasn't loaded.
  // Clamp to the LIBRARY_VIEW_MODES tuple defensively in case the
  // blob carries an unknown value from a future client version.
  const { preferences, setPreferences } = usePreferences();
  const persistedViewMode =
    preferences.libraryViewMode &&
    (LIBRARY_VIEW_MODES as readonly string[]).includes(preferences.libraryViewMode)
      ? (preferences.libraryViewMode as LibraryViewMode)
      : DEFAULT_VIEW_MODE;
  // `useCallback` (audit 2026-06 passe 2) — see the Goals filter hook
  // for the why : an inline setter defeated the provider's
  // field-by-field memo, re-rendering every tile on every keystroke.
  const setViewMode = useCallback(
    (next: LibraryViewMode): void => {
      const cur = useNodeaStore.getState().preferences.libraryViewMode;
      if (next === cur) return;
      void setPreferences({ libraryViewMode: next });
    },
    [setPreferences],
  );
  const viewMode = persistedViewMode;

  const allTags = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const it of items) for (const t of it.tags ?? []) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [items]);

  // Deferred search — keeps the input responsive while the filter
  // pass over N items runs at deferred priority (audit 2026-06).
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredItems = useMemo<LibraryItem[]>(() => {
    const trimmedQuery = deferredSearchQuery.trim();
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
  }, [items, statusFilter, tagFilter, cellFilter, deferredSearchQuery]);

  const groups = useMemo<LibraryGroup[]>(
    () => buildGroups(filteredItems, groupBy, t),
    [filteredItems, groupBy, t],
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
