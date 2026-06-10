/**
 * Library data hook (REFACTO-08).
 *
 * Owns the three encrypted collections that back the Library view :
 * items, reviews, covers. Drives the initial fetch + the `LoadState`
 * machine, and exposes setters so the actions hook can apply
 * optimistic updates / rollbacks.
 *
 * Covers are fetched LAZILY (audit 2026-06 passe 2). Only three of
 * the five view modes render thumbnails (`list-cover`, `grid`,
 * `wall`) ; the default `list-plain` and `table` never touch them.
 * Cover blobs are by far the heaviest payload in the module (full
 * base64 images), so downloading + decrypting every one at mount —
 * even when the active view shows none — was a large, pointless cost
 * on a big library. The covers fetch now runs in its own effect,
 * gated on `coversNeeded`, and memoises which `itemsVersion` it last
 * fetched so flipping back and forth between a plain list and the
 * grid doesn't re-download them. Items + reviews still load eagerly :
 * they back every view and are cheap.
 *
 * Not a React context — the provider in `../context.tsx` consumes
 * this hook and republishes the relevant slice via `LibraryDataValue`.
 * Splitting it out keeps the provider focused on orchestration, and
 * makes the data flow easy to read in isolation.
 */
import { useEffect, useRef, useState } from 'react';

import {
  libraryCoversClient,
  libraryItemsClient,
  libraryReviewsClient,
} from '@/core/api/modules/library';
import type { ModuleClient } from '@/core/modules/use-module-client';
import type { LoadState } from '@/core/types/load-state';
import { useI18n } from '@/i18n/I18nProvider.jsx';

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
  coversNeeded: boolean,
): LibraryDataState {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [reviews, setReviews] = useState<LibraryReview[]>([]);
  const [covers, setCovers] = useState<Map<string, string>>(() => new Map());
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  // `t` is read through a ref so a language switch never re-runs the
  // fetch effect (it would re-download every cover blob for a label).
  // Cost : an error message rendered before a language switch keeps
  // the previous language until the next fetch — acceptable for a
  // rare failure banner.
  const { t } = useI18n();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Items + reviews back every view — always loaded, and they drive
  // the `LoadState` machine (covers are decorative, never gate it).
  useEffect(() => {
    if (!ctx) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    Promise.all([
      libraryItemsClient.list(ctx.moduleUserId, ctx.mainKey),
      libraryReviewsClient.list(ctx.moduleUserId, ctx.mainKey),
    ])
      .then(([itemRecords, reviewRecords]) => {
        if (cancelled) return;
        setItems(itemRecords.map(itemFromRecord));
        setReviews(reviewRecords.map(reviewFromRecord));
        setLoad({ status: 'ready' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : tRef.current('library.list.loadError');
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, itemsVersion, reviewsVersion]);

  // Covers — lazy. Only fetched when a thumbnail view is active, and
  // memoised by the `itemsVersion` they were fetched for, so toggling
  // between a plain list and the grid doesn't re-download the blobs.
  // A new item (version bump) while the grid is open re-runs this and
  // picks up its cover. Failures are swallowed : a missing thumbnail
  // degrades to the placeholder ItemRow already renders, it must not
  // tear down the list. The ref is reset on failure so a later switch
  // retries.
  const coversFetchedForVersion = useRef<number | null>(null);
  useEffect(() => {
    if (!ctx || !coversNeeded) return undefined;
    if (coversFetchedForVersion.current === itemsVersion) return undefined;
    let cancelled = false;
    coversFetchedForVersion.current = itemsVersion;
    libraryCoversClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((coverRecords) => {
        if (cancelled) return;
        setCovers(buildCoverMap(coverRecords));
      })
      .catch(() => {
        if (cancelled) return;
        // Allow a retry on the next trigger — don't poison the latch.
        coversFetchedForVersion.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, coversNeeded, itemsVersion]);

  return { items, reviews, covers, load, setItems, setReviews };
}
