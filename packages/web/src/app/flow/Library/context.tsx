import { useMemo, type ReactNode } from 'react';
import { type LibraryStatus } from '@nodea/shared';

import { createModuleContexts } from '@/core/contexts/module-contexts';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import type { LoadState } from '@/core/types/load-state';

import { type CellFilter } from './lib/cell-filter';
import { type LibraryGroupBy } from './lib/grouping';
import type { LibraryGroup, LibraryItem, LibraryReview } from './lib/types';
// State hooks — aliased to `…State` so they don't clash with the
// `useLibraryData / Filters / Actions` accessors we re-export from
// the React context below.
import { useLibraryActions as useActionsState } from './state/use-library-actions';
import type { LibraryReviewPickerState } from './state/use-library-actions';
import { useLibraryData as useDataState } from './state/use-library-data';
import {
  LIBRARY_VIEW_MODES,
  useLibraryFilters as useFiltersState,
  type LibraryViewMode,
} from './state/use-library-filters';

/**
 * Library page-local state, exposed through three React contexts so
 * that consumers only re-render on the slice they actually read.
 *
 *   - `LibraryDataContext`    — `items`, `reviews`, `covers`, `load`.
 *     Changes when the page loads / refetches / mutates data.
 *   - `LibraryFiltersContext` — raw filter state (status / tag /
 *     group-by / view mode / cell filter), the derived `allTags` /
 *     `filteredItems` / `groups`, and the matching setters. Changes
 *     on every filter interaction.
 *   - `LibraryActionsContext` — handlers (edit / delete / favorite
 *     / reviews) and the review-picker UI state. Callbacks are
 *     memoised with `useCallback` and read live data via refs so
 *     their identity stays stable across data fetches ; consumers
 *     that only need actions don't re-render when items / reviews
 *     change.
 *
 * The provider hosts three sub-hooks (`useLibraryData`, `…Filters`,
 * `…Actions`, in `state/`) and republishes the relevant slices via
 * the three contexts. The privacy invariant (URL stays `/flow`,
 * sub-view in the global Zustand store) is preserved — this provider
 * is *page-local* state only, never persisted, never sent to the
 * server.
 *
 * Split (REFACTO-08) : the file used to host every `useState` /
 * `useEffect` / `useMemo` / `useCallback` inline (~480 LOC). Moved
 * the data fetch to `state/use-library-data.ts`, the filter logic to
 * `state/use-library-filters.ts`, and the 11 action callbacks to
 * `state/use-library-actions.ts`. The provider now orchestrates.
 */

// Re-export view-mode union + picker type so existing consumers
// (sidebar, view switcher) keep their import path stable.
export { LIBRARY_VIEW_MODES };
export type { LibraryViewMode, LibraryReviewPickerState };

/* ---- Context value shapes --------------------------------------- */

interface LibraryDataValue {
  items: LibraryItem[];
  reviews: LibraryReview[];
  covers: Map<string, string>;
  load: LoadState;
}

interface LibraryFiltersValue {
  statusFilter: LibraryStatus | 'all' | 'favorites';
  tagFilter: string | null;
  groupBy: LibraryGroupBy;
  viewMode: LibraryViewMode;
  cellFilter: CellFilter | null;

  allTags: string[];
  filteredItems: LibraryItem[];
  groups: LibraryGroup[];

  setStatusFilter: (next: LibraryStatus | 'all' | 'favorites') => void;
  setTagFilter: (next: string | null) => void;
  setGroupBy: (next: LibraryGroupBy) => void;
  setViewMode: (next: LibraryViewMode) => void;
  setCellFilter: (next: CellFilter | null) => void;
}

interface LibraryActionsValue {
  reviewPicker: LibraryReviewPickerState;
  addItem: () => void;
  editItem: (it: LibraryItem) => void;
  deleteItem: (it: LibraryItem) => Promise<void>;
  toggleFavorite: (it: LibraryItem) => void;
  addReview: (itemId: string) => void;
  editReview: (review: LibraryReview) => void;
  deleteReview: (review: LibraryReview) => Promise<void>;
  openReviewPicker: (kind: 'quote' | 'note') => void;
  closeReviewPicker: () => void;
  pickBookForReview: (itemId: string, kind: 'quote' | 'note') => void;
}

const {
  Provider: LibraryContexts,
  useData: useLibraryData,
  useFilters: useLibraryFilters,
  useActions: useLibraryActions,
} = createModuleContexts<
  LibraryDataValue,
  LibraryFiltersValue,
  LibraryActionsValue
>('Library');

// eslint-disable-next-line react-refresh/only-export-components
export { useLibraryData, useLibraryFilters, useLibraryActions };

/* ---- Provider --------------------------------------------------- */

export function LibraryProvider({ children }: { children: ReactNode }) {
  const ctx = useModuleClient('library');
  const itemsVersion = useNodeaStore((s) => s.libraryItemsVersion);
  const reviewsVersion = useNodeaStore((s) => s.libraryReviewsVersion);
  const bumpItemsVersion = useNodeaStore((s) => s.bumpLibraryItemsVersion);
  const bumpReviewsVersion = useNodeaStore((s) => s.bumpLibraryReviewsVersion);
  const openComposer = useNodeaStore((s) => s.openComposer);

  const data = useDataState(ctx, itemsVersion, reviewsVersion);
  const filters = useFiltersState(data.items);
  const actions = useActionsState({
    ctx,
    items: data.items,
    reviews: data.reviews,
    setItems: data.setItems,
    setReviews: data.setReviews,
    bumpItemsVersion,
    bumpReviewsVersion,
    openComposer,
  });

  // ---- Memoised context values ----

  const dataValue = useMemo<LibraryDataValue>(
    () => ({
      items: data.items,
      reviews: data.reviews,
      covers: data.covers,
      load: data.load,
    }),
    [data.items, data.reviews, data.covers, data.load],
  );

  const filtersValue = useMemo<LibraryFiltersValue>(
    () => ({
      statusFilter: filters.statusFilter,
      tagFilter: filters.tagFilter,
      groupBy: filters.groupBy,
      viewMode: filters.viewMode,
      cellFilter: filters.cellFilter,
      allTags: filters.allTags,
      filteredItems: filters.filteredItems,
      groups: filters.groups,
      setStatusFilter: filters.setStatusFilter,
      setTagFilter: filters.setTagFilter,
      setGroupBy: filters.setGroupBy,
      setViewMode: filters.setViewMode,
      setCellFilter: filters.setCellFilter,
    }),
    [filters],
  );

  const actionsValue = useMemo<LibraryActionsValue>(
    () => ({
      reviewPicker: actions.reviewPicker,
      addItem: actions.addItem,
      editItem: actions.editItem,
      deleteItem: actions.deleteItem,
      toggleFavorite: actions.toggleFavorite,
      addReview: actions.addReview,
      editReview: actions.editReview,
      deleteReview: actions.deleteReview,
      openReviewPicker: actions.openReviewPicker,
      closeReviewPicker: actions.closeReviewPicker,
      pickBookForReview: actions.pickBookForReview,
    }),
    [actions],
  );

  return (
    <LibraryContexts data={dataValue} filters={filtersValue} actions={actionsValue}>
      {children}
    </LibraryContexts>
  );
}
