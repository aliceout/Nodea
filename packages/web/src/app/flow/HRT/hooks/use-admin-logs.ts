/**
 * HRT · Administration — data hook for the dose / injection log.
 *
 * Self-contained (no global store slice) : loads + decrypts the
 * `hrt-admin-logs` collection via the typed client, exposes the
 * entries newest-first plus create / update / remove that re-fetch on
 * success. Kept local to the view because HRT's two sub-views own
 * separate collections and never need each other's data mounted at
 * once — simpler than the 3-context factory the bigger modules use.
 */
import { useCallback, useEffect, useState } from 'react';

import type { HrtAdminLogPayload } from '@nodea/shared';
import { hrtAdminLogsClient } from '@/core/api/modules/hrt';
import { useModuleClient } from '@/core/modules/use-module-client';
import type { LoadState } from '@/core/types/load-state';

export interface AdminLogEntry {
  id: string;
  payload: HrtAdminLogPayload;
}

/** Newest-first sort key : event date then time (both lexicographic). */
function sortKey(e: AdminLogEntry): string {
  return `${e.payload.date} ${e.payload.time}`;
}

export interface UseHrtAdminLogs {
  entries: ReadonlyArray<AdminLogEntry>;
  load: LoadState;
  /** True once the module is hydrated and API calls can be made. */
  ready: boolean;
  create: (payload: HrtAdminLogPayload) => Promise<void>;
  update: (id: string, payload: HrtAdminLogPayload) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useHrtAdminLogs(): UseHrtAdminLogs {
  const ctx = useModuleClient('hrt');
  const [entries, setEntries] = useState<AdminLogEntry[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!ctx) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    hrtAdminLogsClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((records) => {
        if (cancelled) return;
        const next = records
          .map((r) => ({ id: r.id, payload: r.payload }))
          .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
        setEntries(next);
        setLoad({ status: 'ready' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Chargement impossible.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, version]);

  const create = useCallback(
    async (payload: HrtAdminLogPayload) => {
      if (!ctx) return;
      await hrtAdminLogsClient.create(ctx.moduleUserId, ctx.mainKey, payload);
      reload();
    },
    [ctx, reload],
  );

  const update = useCallback(
    async (id: string, payload: HrtAdminLogPayload) => {
      if (!ctx) return;
      await hrtAdminLogsClient.update(ctx.moduleUserId, ctx.mainKey, id, payload);
      reload();
    },
    [ctx, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!ctx) return;
      // Optimistic removal — drop the row immediately, re-fetch on
      // success to converge. On failure we reload to restore truth.
      setEntries((prev) => prev.filter((e) => e.id !== id));
      try {
        await hrtAdminLogsClient.remove(ctx.moduleUserId, ctx.mainKey, id);
        reload();
      } catch (err) {
        if (import.meta.env.DEV) console.warn('hrt: delete failed', err);
        reload();
      }
    },
    [ctx, reload],
  );

  return { entries, load, ready: !!ctx, create, update, remove };
}
