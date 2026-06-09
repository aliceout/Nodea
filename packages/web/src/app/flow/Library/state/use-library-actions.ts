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
  type LibraryReviewKind,
} from '@nodea/shared';

import {
  libraryItemsClient,
  libraryReviewsClient,
} from '@/core/api/modules/library';
import type { ModuleClient } from '@/core/modules/use-module-client';
import { createMutationTracker } from '@/core/state/mutation-tracker';

import type { LibraryItem, LibraryReview } from '../lib/types';

type ReviewKind = LibraryReviewKind;

/** UI state for the « + Nouvel extrait » / « + Nouvelle note » two-
 *  step flow : the user picks a parent book first, then the inline
 *  review form opens with the kind + itemRid pre-filled. */
export type LibraryReviewPickerState =
  | { open: false }
  | { open: true; kind: ReviewKind };

/** Inline form state for the Library item path. `null` = form closed
 *  ; `{ mode: 'create' }` = create flow ; `{ mode: 'edit', item }` =
 *  editing an existing book. Mirrors the Mood / Goals / Journal
 *  posture — `openComposer` from the global Zustand slice is no
 *  longer used by Library. */
export type LibraryItemFormState =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; item: LibraryItem };

/** Inline form state for the Library review path. `null` = form
 *  closed ; on create the parent itemRid + chosen kind are baked in
 *  (the picker hands them over) ; on edit the source-of-truth is the
 *  existing review. */
export type LibraryReviewFormState =
  | null
  | { mode: 'create'; itemRid: string; kind: ReviewKind }
  | { mode: 'edit'; review: LibraryReview };

export interface LibraryActionsState {
  reviewPicker: LibraryReviewPickerState;
  itemForm: LibraryItemFormState;
  reviewForm: LibraryReviewFormState;
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
  closeItemForm: () => void;
  closeReviewForm: () => void;
}

interface LibraryActionsDeps {
  ctx: ModuleClient | null;
  items: LibraryItem[];
  reviews: LibraryReview[];
  setItems: React.Dispatch<React.SetStateAction<LibraryItem[]>>;
  setReviews: React.Dispatch<React.SetStateAction<LibraryReview[]>>;
  bumpItemsVersion: () => void;
  bumpReviewsVersion: () => void;
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
  } = deps;

  const [reviewPicker, setReviewPicker] =
    useState<LibraryReviewPickerState>({ open: false });
  const [itemForm, setItemForm] = useState<LibraryItemFormState>(null);
  const [reviewForm, setReviewForm] = useState<LibraryReviewFormState>(null);

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
    setItemForm({ mode: 'create' });
  }, []);

  const editItem = useCallback((it: LibraryItem) => {
    setItemForm({ mode: 'edit', item: it });
  }, []);

  const closeItemForm = useCallback(() => {
    setItemForm(null);
  }, []);

  const closeReviewForm = useCallback(() => {
    setReviewForm(null);
  }, []);

  // FRONT-13 tracker (audit 2026-06) : Library used to roll back by
  // restoring a snapshot of the ENTIRE list captured before the
  // mutation — a failed delete undid every concurrent action made in
  // the meantime (a favorite toggled on another book, etc.). Same
  // per-entry token pattern as Mood / Goals now.
  const trackerRef = useRef(createMutationTracker<string>());

  const deleteItem = useCallback(
    async (it: LibraryItem) => {
      if (!ctx) return;
      if (!window.confirm(`Supprimer « ${it.title} » et ses reviews ?`)) return;
      trackerRef.current.begin(it.id);
      const orphanReviews = reviewsRef.current.filter(
        (r) => r.itemRid === it.id,
      );
      setItems((prev) => prev.filter((i) => i.id !== it.id));
      setReviews((prev) => prev.filter((r) => r.itemRid !== it.id));
      try {
        // Delete reviews first so we never leave orphans if the
        // item delete fails. They're encrypted but unreachable, so
        // failing here is a soft warning rather than a hard error.
        await Promise.all(
          orphanReviews.map((r) =>
            libraryReviewsClient.remove(ctx.moduleUserId, ctx.mainKey, r.id),
          ),
        );
        await libraryItemsClient.remove(ctx.moduleUserId, ctx.mainKey, it.id);
        // Success : the optimistic removal IS the server state — no
        // refetch needed (the old bump re-downloaded all 3
        // collections, covers included, after every delete).
        trackerRef.current.forget(it.id);
      } catch (err) {
        // Partial failure (some reviews may be gone server-side, the
        // item may remain) — a local snapshot can't represent that.
        // Refetch both collections so the UI converges on the
        // server's truth instead of resurrecting deleted reviews.
        bumpItemsVersion();
        bumpReviewsVersion();
        if (import.meta.env.DEV)
          console.warn('library: delete item failed', err);
      }
    },
    [ctx, bumpItemsVersion, bumpReviewsVersion, setItems, setReviews],
  );

  const toggleFavorite = useCallback(
    (it: LibraryItem) => {
      if (!ctx) return;
      const next = !it.isFavorite;
      const token = trackerRef.current.begin(it.id);
      setItems((prev) =>
        prev.map((i) => (i.id === it.id ? { ...i, isFavorite: next } : i)),
      );
      // Strip the row id before persisting — `LibraryItem` is
      // payload + id, and the loose payload schema would happily
      // store the stray `id` field inside the encrypted blob on
      // every toggle (audit 2026-06).
      const { id: _rowId, ...payload } = it;
      libraryItemsClient
        .update(ctx.moduleUserId, ctx.mainKey, it.id, {
          ...(payload as LibraryItemPayload),
          isFavorite: next,
        })
        // Success : optimistic state is the server state — no
        // refetch. The old bump re-downloaded every cover blob
        // (10-20 MB at 300 books) for a one-boolean flip.
        .catch((err) => {
          if (!trackerRef.current.isLatest(it.id, token)) return;
          setItems((prev) =>
            prev.map((i) =>
              i.id === it.id ? { ...i, isFavorite: !next } : i,
            ),
          );
          if (import.meta.env.DEV)
            console.warn('library: favorite toggle failed', err);
        });
    },
    [ctx, setItems],
  );

  const addReview = useCallback((itemId: string) => {
    setReviewForm({ mode: 'create', itemRid: itemId, kind: 'note' });
  }, []);

  const editReview = useCallback((review: LibraryReview) => {
    setReviewForm({ mode: 'edit', review });
  }, []);

  const deleteReview = useCallback(
    async (review: LibraryReview) => {
      if (!ctx) return;
      if (!window.confirm('Supprimer cette review ?')) return;
      const token = trackerRef.current.begin(review.id);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      try {
        await libraryReviewsClient.remove(
          ctx.moduleUserId,
          ctx.mainKey,
          review.id,
        );
        // Success : optimistic removal is the server state — no
        // refetch needed.
        trackerRef.current.forget(review.id);
      } catch (err) {
        if (!trackerRef.current.isLatest(review.id, token)) return;
        // Targeted rollback : re-insert THIS review only (the views
        // re-sort by date, so position doesn't matter).
        setReviews((prev) => [review, ...prev]);
        if (import.meta.env.DEV)
          console.warn('library: delete review failed', err);
      }
    },
    [ctx, setReviews],
  );

  const openReviewPicker = useCallback((kind: ReviewKind) => {
    setReviewPicker({ open: true, kind });
  }, []);

  const closeReviewPicker = useCallback(() => {
    setReviewPicker({ open: false });
  }, []);

  /** Called by the picker once the user chose which book the new
   *  review attaches to. Closes the picker and opens the inline
   *  review form with the kind + itemRid pre-filled. */
  const pickBookForReview = useCallback(
    (itemId: string, kind: ReviewKind) => {
      setReviewPicker({ open: false });
      setReviewForm({ mode: 'create', itemRid: itemId, kind });
    },
    [],
  );

  return {
    reviewPicker,
    itemForm,
    reviewForm,
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
    closeItemForm,
    closeReviewForm,
  };
}
