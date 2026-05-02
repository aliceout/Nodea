import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  type LibraryItemPayload,
  type LibraryReviewPayload,
  type LibraryStatus,
} from '@nodea/shared';

import {
  libraryCoversClient,
  libraryItemsClient,
  libraryReviewsClient,
} from '@/core/api/modules/library';
import { createModuleContexts } from '@/core/contexts/module-contexts';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import type { LoadState } from '@/core/types/load-state';

import { matchesCellFilter, type CellFilter } from './lib/cell-filter';
import { buildGroups, type LibraryGroupBy } from './lib/grouping';
import { itemFromRecord, reviewFromRecord, buildCoverMap } from './lib/mappers';
import type { LibraryGroup, LibraryItem, LibraryReview } from './lib/types';

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
 * The provider hosts every `useState` / `useEffect` / `useMemo` /
 * `useCallback` ; downstream views read via the three hooks. The
 * privacy invariant (URL stays `/flow`, sub-view in the global
 * Zustand store) is preserved — this provider is *page-local* state
 * only, never persisted, never sent to the server.
 */

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

type ReviewKind = 'quote' | 'note';

/** UI state for the « + Nouvel extrait » / « + Nouvelle note » two-
 *  step flow : the user picks a parent book first, then the standard
 *  composer opens with the kind + item_rid pre-filled. */
export type LibraryReviewPickerState =
  | { open: false }
  | { open: true; kind: ReviewKind };

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
  openReviewPicker: (kind: ReviewKind) => void;
  closeReviewPicker: () => void;
  pickBookForReview: (itemId: string, kind: ReviewKind) => void;
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
  // ---- Pulled from the global store ----
  const ctx = useModuleClient('library');
  const itemsVersion = useNodeaStore((s) => s.libraryItemsVersion);
  const reviewsVersion = useNodeaStore((s) => s.libraryReviewsVersion);
  const bumpItemsVersion = useNodeaStore((s) => s.bumpLibraryItemsVersion);
  const bumpReviewsVersion = useNodeaStore((s) => s.bumpLibraryReviewsVersion);
  const openComposer = useNodeaStore((s) => s.openComposer);

  // ---- Data state ----
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [reviews, setReviews] = useState<LibraryReview[]>([]);
  // Decrypted cover blobs, keyed by the cover record's id (= the
  // value stored on `item.cover_rid`). Built once at mount from the
  // bulk decrypt of the `library-covers` collection.
  const [covers, setCovers] = useState<Map<string, string>>(() => new Map());
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  // ---- Filter state ----
  const [statusFilter, setStatusFilter] =
    useState<LibraryStatus | 'all' | 'favorites'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<LibraryGroupBy>('status');
  const [cellFilter, setCellFilter] = useState<CellFilter | null>(null);
  const [viewMode, setViewMode] = useState<LibraryViewMode>(() => readViewMode());

  // ---- Transient UI state ----
  const [reviewPicker, setReviewPicker] =
    useState<LibraryReviewPickerState>({ open: false });

  // Refs let action callbacks read the freshest data without
  // listing items / reviews in their dep arrays. Optimistic-update
  // rollbacks need a snapshot of the pre-mutation array, captured
  // here without invalidating the callback's identity on every
  // data fetch — that's what keeps the actions context value
  // referentially stable for consumers that only depend on it.
  const itemsRef = useRef(items);
  const reviewsRef = useRef(reviews);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    reviewsRef.current = reviews;
  }, [reviews]);

  // viewMode persistence (localStorage).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  // Initial load (and re-load on bump).
  useEffect(() => {
    if (!ctx) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    Promise.all([
      libraryItemsClient.list(ctx.moduleUserId, ctx.mainKey),
      libraryReviewsClient.list(ctx.moduleUserId, ctx.mainKey),
      libraryCoversClient.list(ctx.moduleUserId, ctx.mainKey),
    ])
      .then(([itemRecords, reviewRecords, coverRecords]) => {
        if (cancelled) return;
        setItems(itemRecords.map(itemFromRecord));
        setReviews(reviewRecords.map(reviewFromRecord));
        setCovers(buildCoverMap(coverRecords));
        setLoad({ status: 'ready' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Erreur lors du chargement de la bibliothèque.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, itemsVersion, reviewsVersion]);

  // ---- Derived ----
  const allTags = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const it of items) for (const t of it.tags ?? []) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [items]);

  const filteredItems = useMemo<LibraryItem[]>(() => {
    return items.filter((it) => {
      if (statusFilter === 'favorites') {
        if (!it.is_favorite) return false;
      } else if (statusFilter !== 'all' && it.status !== statusFilter) {
        return false;
      }
      if (tagFilter && !(it.tags ?? []).includes(tagFilter)) return false;
      if (cellFilter && !matchesCellFilter(it, cellFilter)) return false;
      return true;
    });
  }, [items, statusFilter, tagFilter, cellFilter]);

  const groups = useMemo<LibraryGroup[]>(
    () => buildGroups(filteredItems, groupBy),
    [filteredItems, groupBy],
  );

  // ---- Actions (stable callbacks via refs) ----

  const addItem = useCallback(() => {
    openComposer('library-item');
  }, [openComposer]);

  const editItem = useCallback(
    (it: LibraryItem) => {
      const { id, ...payload } = it;
      openComposer('library-item', {
        type: 'library-item',
        id,
        payload: payload as LibraryItemPayload,
      });
    },
    [openComposer],
  );

  const deleteItem = useCallback(
    async (it: LibraryItem) => {
      if (!ctx) return;
      if (!window.confirm(`Supprimer « ${it.title} » et ses reviews ?`)) return;
      const previousItems = itemsRef.current;
      const previousReviews = reviewsRef.current;
      setItems((prev) => prev.filter((i) => i.id !== it.id));
      setReviews((prev) => prev.filter((r) => r.item_rid !== it.id));
      try {
        // Delete reviews first so we never leave orphans if the
        // item delete fails. They're encrypted but unreachable, so
        // failing here is a soft warning rather than a hard error.
        const orphanReviews = previousReviews.filter(
          (r) => r.item_rid === it.id,
        );
        await Promise.all(
          orphanReviews.map((r) =>
            libraryReviewsClient.remove(ctx.moduleUserId, ctx.mainKey, r.id),
          ),
        );
        await libraryItemsClient.remove(ctx.moduleUserId, ctx.mainKey, it.id);
        bumpItemsVersion();
        bumpReviewsVersion();
      } catch (err) {
        setItems(previousItems);
        setReviews(previousReviews);
        if (import.meta.env.DEV)
          console.warn('library: delete item failed', err);
      }
    },
    [ctx, bumpItemsVersion, bumpReviewsVersion],
  );

  const toggleFavorite = useCallback(
    (it: LibraryItem) => {
      if (!ctx) return;
      const next = !it.is_favorite;
      const previous = itemsRef.current;
      setItems((prev) =>
        prev.map((i) => (i.id === it.id ? { ...i, is_favorite: next } : i)),
      );
      libraryItemsClient
        .update(ctx.moduleUserId, ctx.mainKey, it.id, {
          ...(it as LibraryItemPayload),
          is_favorite: next,
        })
        .then(() => bumpItemsVersion())
        .catch((err) => {
          setItems(previous);
          if (import.meta.env.DEV)
            console.warn('library: favorite toggle failed', err);
        });
    },
    [ctx, bumpItemsVersion],
  );

  const addReview = useCallback(
    (itemId: string) => {
      openComposer('library-review', {
        type: 'library-review',
        id: '',
        payload: {
          item_rid: itemId,
          date: new Date().toISOString(),
          kind: 'note',
          title: null,
          content: '',
          page: null,
          spoiler: false,
        },
      });
    },
    [openComposer],
  );

  const editReview = useCallback(
    (review: LibraryReview) => {
      const { id, ...payload } = review;
      openComposer('library-review', {
        type: 'library-review',
        id,
        payload: payload as LibraryReviewPayload,
      });
    },
    [openComposer],
  );

  const deleteReview = useCallback(
    async (review: LibraryReview) => {
      if (!ctx) return;
      if (!window.confirm('Supprimer cette review ?')) return;
      const previous = reviewsRef.current;
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      try {
        await libraryReviewsClient.remove(
          ctx.moduleUserId,
          ctx.mainKey,
          review.id,
        );
        bumpReviewsVersion();
      } catch (err) {
        setReviews(previous);
        if (import.meta.env.DEV)
          console.warn('library: delete review failed', err);
      }
    },
    [ctx, bumpReviewsVersion],
  );

  const openReviewPicker = useCallback((kind: ReviewKind) => {
    setReviewPicker({ open: true, kind });
  }, []);

  const closeReviewPicker = useCallback(() => {
    setReviewPicker({ open: false });
  }, []);

  /** Called by the picker once the user chose which book the new
   *  review attaches to. Closes the picker and opens the standard
   *  review composer with the kind + item_rid pre-filled. */
  const pickBookForReview = useCallback(
    (itemId: string, kind: ReviewKind) => {
      setReviewPicker({ open: false });
      openComposer('library-review', {
        type: 'library-review',
        id: '',
        payload: {
          item_rid: itemId,
          date: new Date().toISOString(),
          kind,
          title: null,
          content: '',
          page: null,
          spoiler: false,
        },
      });
    },
    [openComposer],
  );

  // ---- Memoised context values ----

  const dataValue = useMemo<LibraryDataValue>(
    () => ({ items, reviews, covers, load }),
    [items, reviews, covers, load],
  );

  const filtersValue = useMemo<LibraryFiltersValue>(
    () => ({
      statusFilter,
      tagFilter,
      groupBy,
      viewMode,
      cellFilter,
      allTags,
      filteredItems,
      groups,
      setStatusFilter,
      setTagFilter,
      setGroupBy,
      setViewMode,
      setCellFilter,
    }),
    [
      statusFilter,
      tagFilter,
      groupBy,
      viewMode,
      cellFilter,
      allTags,
      filteredItems,
      groups,
    ],
  );

  const actionsValue = useMemo<LibraryActionsValue>(
    () => ({
      reviewPicker,
      addItem,
      editItem,
      deleteItem,
      toggleFavorite,
      addReview,
      editReview,
      deleteReview,
      openReviewPicker,
      closeReviewPicker,
      pickBookForReview,
    }),
    [
      reviewPicker,
      addItem,
      editItem,
      deleteItem,
      toggleFavorite,
      addReview,
      editReview,
      deleteReview,
      openReviewPicker,
      closeReviewPicker,
      pickBookForReview,
    ],
  );

  return (
    <LibraryContexts data={dataValue} filters={filtersValue} actions={actionsValue}>
      {children}
    </LibraryContexts>
  );
}
