/**
 * Library actions hook (REFACTO-08).
 *
 * Owns the action callbacks (add/edit/delete item, toggle favorite,
 * add/edit/delete review, picker open/close/pick) plus the transient
 * UI state for the « + Nouvel extrait » / « + Nouvelle note » two-
 * step picker.
 *
 * **Why refs internally** : the callbacks need to read the freshest
 * `items` / `reviews` for optimistic-update rollbacks, but listing
 * them in the `useCallback` dep arrays would invalidate every
 * callback on every data fetch — and that re-renders every consumer
 * of the actions context. The hook keeps refs internally, mirrors
 * them in `useEffect`, and the callbacks read via the ref. Result :
 * action identities stay stable across data fetches, which is the
 * whole point of splitting `actions` from `data` / `filters`.
 *
 * Not a React context — the provider in `../context.tsx` consumes
 * this hook and republishes via `LibraryActionsValue`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type LibraryItemPayload,
  type LibraryReviewPayload,
} from '@nodea/shared';

import {
  libraryItemsClient,
  libraryReviewsClient,
} from '@/core/api/modules/library';
import type { ModuleClient } from '@/core/modules/use-module-client';
import type { ComposerEditing, ComposerType } from '@/core/store/nodea-store';

import type { LibraryItem, LibraryReview } from '../lib/types';

type ReviewKind = 'quote' | 'note';

/** UI state for the « + Nouvel extrait » / « + Nouvelle note » two-
 *  step flow : the user picks a parent book first, then the standard
 *  composer opens with the kind + item_rid pre-filled. */
export type LibraryReviewPickerState =
  | { open: false }
  | { open: true; kind: ReviewKind };

export interface LibraryActionsState {
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

interface LibraryActionsDeps {
  ctx: ModuleClient | null;
  items: LibraryItem[];
  reviews: LibraryReview[];
  setItems: React.Dispatch<React.SetStateAction<LibraryItem[]>>;
  setReviews: React.Dispatch<React.SetStateAction<LibraryReview[]>>;
  bumpItemsVersion: () => void;
  bumpReviewsVersion: () => void;
  openComposer: (kind?: ComposerType, editing?: ComposerEditing) => void;
}

export function useLibraryActions(deps: LibraryActionsDeps): LibraryActionsState {
  const {
    ctx,
    items,
    reviews,
    setItems,
    setReviews,
    bumpItemsVersion,
    bumpReviewsVersion,
    openComposer,
  } = deps;

  const [reviewPicker, setReviewPicker] =
    useState<LibraryReviewPickerState>({ open: false });

  // Refs let callbacks read the freshest data without listing items /
  // reviews in their dep arrays. See file-level comment for the why.
  const itemsRef = useRef(items);
  const reviewsRef = useRef(reviews);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    reviewsRef.current = reviews;
  }, [reviews]);

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
    [ctx, bumpItemsVersion, bumpReviewsVersion, setItems, setReviews],
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
    [ctx, bumpItemsVersion, setItems],
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
    [ctx, bumpReviewsVersion, setReviews],
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

  return {
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
  };
}
