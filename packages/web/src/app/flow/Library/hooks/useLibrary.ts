import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  libraryItemsClient,
  libraryReviewsClient,
} from '@/core/api/modules/library';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { LibraryItemPayload, LibraryReviewPayload } from '@nodea/shared';

export type LibItem = DecryptedRecord<LibraryItemPayload>;
export type LibReview = DecryptedRecord<LibraryReviewPayload>;

export interface LibraryContext {
  ready: boolean;
  keyMissing: boolean;
  moduleMissing: boolean;
  loading: boolean;
  error: string | null;
  items: LibItem[];
  reviews: LibReview[];
  refresh(): Promise<void>;
  createItem(payload: LibraryItemPayload): Promise<void>;
  updateItem(id: string, payload: LibraryItemPayload): Promise<void>;
  deleteItem(id: string): Promise<void>;
  createReview(payload: LibraryReviewPayload): Promise<void>;
  deleteReview(id: string): Promise<void>;
}

export function useLibrary(): LibraryContext {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const itemsSid = modules['library-items']?.moduleUserId ?? null;
  const reviewsSid = modules['library-reviews']?.moduleUserId ?? null;

  const ready = Boolean(mainKey && itemsSid && reviewsSid);

  const [items, setItems] = useState<LibItem[]>([]);
  const [reviews, setReviews] = useState<LibReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mainKey || !itemsSid || !reviewsSid) return;
    setError(null);
    try {
      const [is, rs] = await Promise.all([
        libraryItemsClient.list(itemsSid, mainKey),
        libraryReviewsClient.list(reviewsSid, mainKey),
      ]);
      is.sort((a, b) => a.payload.title.localeCompare(b.payload.title));
      rs.sort((a, b) => b.payload.date.localeCompare(a.payload.date));
      setItems(is);
      setReviews(rs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [mainKey, itemsSid, reviewsSid]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const createItem = useCallback(
    async (payload: LibraryItemPayload) => {
      if (!mainKey || !itemsSid) return;
      await libraryItemsClient.create(itemsSid, mainKey, payload);
      await refresh();
    },
    [mainKey, itemsSid, refresh],
  );
  const updateItem = useCallback(
    async (id: string, payload: LibraryItemPayload) => {
      if (!mainKey || !itemsSid) return;
      await libraryItemsClient.update(itemsSid, mainKey, id, payload);
      await refresh();
    },
    [mainKey, itemsSid, refresh],
  );
  const deleteItem = useCallback(
    async (id: string) => {
      if (!mainKey || !itemsSid) return;
      await libraryItemsClient.remove(itemsSid, mainKey, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    },
    [mainKey, itemsSid],
  );
  const createReview = useCallback(
    async (payload: LibraryReviewPayload) => {
      if (!mainKey || !reviewsSid) return;
      await libraryReviewsClient.create(reviewsSid, mainKey, payload);
      await refresh();
    },
    [mainKey, reviewsSid, refresh],
  );
  const deleteReview = useCallback(
    async (id: string) => {
      if (!mainKey || !reviewsSid) return;
      await libraryReviewsClient.remove(reviewsSid, mainKey, id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
    },
    [mainKey, reviewsSid],
  );

  return useMemo<LibraryContext>(
    () => ({
      ready,
      keyMissing: !mainKey,
      moduleMissing: Boolean(mainKey) && (!itemsSid || !reviewsSid),
      loading,
      error,
      items,
      reviews,
      refresh,
      createItem,
      updateItem,
      deleteItem,
      createReview,
      deleteReview,
    }),
    [
      ready,
      mainKey,
      itemsSid,
      reviewsSid,
      loading,
      error,
      items,
      reviews,
      refresh,
      createItem,
      updateItem,
      deleteItem,
      createReview,
      deleteReview,
    ],
  );
}
