/**
 * Library data hook (REFACTO-08).
 *
 * Owns the three encrypted collections that back the Library view :
 * items, reviews, covers. Drives the parallel initial fetch + the
 * `LoadState` machine, and exposes setters so the actions hook can
 * apply optimistic updates / rollbacks.
 *
 * Not a React context — the provider in `../context.tsx` consumes
 * this hook and republishes the relevant slice via `LibraryDataValue`.
 * Splitting it out keeps the provider focused on orchestration, and
 * makes the data flow easy to read in isolation.
 */
import { useEffect, useState } from 'react';

import {
  libraryCoversClient,
  libraryItemsClient,
  libraryReviewsClient,
} from '@/core/api/modules/library';
import type { ModuleClient } from '@/core/modules/use-module-client';
import type { LoadState } from '@/core/types/load-state';

import { itemFromRecord, reviewFromRecord, buildCoverMap } from '../lib/mappers';
import type { LibraryItem, LibraryReview } from '../lib/types';

export interface LibraryDataState {
  items: LibraryItem[];
  reviews: LibraryReview[];
  /** Decrypted cover blobs, keyed by the cover record's id (= the
   *  value stored on `item.coverRid`). Built once at mount from the
   *  bulk decrypt of the `library-covers` collection. */
  covers: Map<string, string>;
  load: LoadState;
  setItems: React.Dispatch<React.SetStateAction<LibraryItem[]>>;
  setReviews: React.Dispatch<React.SetStateAction<LibraryReview[]>>;
}

export function useLibraryData(
  ctx: ModuleClient | null,
  itemsVersion: number,
  reviewsVersion: number,
): LibraryDataState {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [reviews, setReviews] = useState<LibraryReview[]>([]);
  const [covers, setCovers] = useState<Map<string, string>>(() => new Map());
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

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

  return { items, reviews, covers, load, setItems, setReviews };
}
