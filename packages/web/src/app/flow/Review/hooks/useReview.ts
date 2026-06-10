import { useCallback, useEffect, useMemo, useState } from 'react';
import { reviewClient } from '@/core/api/modules/review';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { ReviewPayload } from '@nodea/shared';

export type ReviewRecord = DecryptedRecord<ReviewPayload>;

export interface ReviewContext {
  ready: boolean;
  keyMissing: boolean;
  moduleMissing: boolean;
  loading: boolean;
  error: string | null;
  entries: ReviewRecord[];
  refresh(): Promise<void>;
  createReview(payload: ReviewPayload): Promise<ReviewRecord | undefined>;
  updateReview(id: string, payload: ReviewPayload): Promise<void>;
  deleteReview(id: string): Promise<void>;
}

/**
 * Single hook for the Review module.
 *
 * **Why bare `selectMainKey + selectModules` instead of
 * `useModuleClient('review')`** : the views consume `keyMissing` vs
 * `moduleMissing` separately to render different empty states (no
 * session vs session-but-module-not-seeded). `useModuleClient`
 * collapses both into a single `null`, losing the discriminator.
 * Using the bare selectors here is intentional, not legacy.
 */
export function useReview(): ReviewContext {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const sid = modules.review?.moduleUserId ?? null;

  const ready = Boolean(mainKey && sid);

  const [entries, setEntries] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mainKey || !sid) return;
    setError(null);
    try {
      const list = await reviewClient.list(sid, mainKey);
      list.sort((a, b) => b.payload.year - a.payload.year);
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [mainKey, sid]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const createReview = useCallback(
    async (payload: ReviewPayload) => {
      if (!mainKey || !sid) return undefined;
      const stamped = { ...payload, updatedAt: new Date().toISOString() };
      const rec = await reviewClient.create(sid, mainKey, stamped);
      await refresh();
      return rec;
    },
    [mainKey, sid, refresh],
  );
  const updateReview = useCallback(
    async (id: string, payload: ReviewPayload) => {
      if (!mainKey || !sid) return;
      const stamped = { ...payload, updatedAt: new Date().toISOString() };
      await reviewClient.update(sid, mainKey, id, stamped);
      await refresh();
    },
    [mainKey, sid, refresh],
  );
  const deleteReview = useCallback(
    async (id: string) => {
      if (!mainKey || !sid) return;
      setError(null);
      try {
        await reviewClient.remove(sid, mainKey, id);
        // Remove locally only after the server confirms (audit 2026-06
        // passe 2, 3.7) : the old code had no catch, so a failed remove
        // threw an unhandled rejection and the user got zero feedback —
        // the row stayed with no explanation. Now the row stays AND the
        // error banner explains why.
        setEntries((prev) => prev.filter((e) => e.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de suppression.');
      }
    },
    [mainKey, sid],
  );

  return useMemo<ReviewContext>(
    () => ({
      ready,
      keyMissing: !mainKey,
      moduleMissing: Boolean(mainKey) && !sid,
      loading,
      error,
      entries,
      refresh,
      createReview,
      updateReview,
      deleteReview,
    }),
    [ready, mainKey, sid, loading, error, entries, refresh, createReview, updateReview, deleteReview],
  );
}
