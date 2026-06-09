/**
 * HRT · Administration — data hook for the dose / injection log.
 *
 * Self-contained (no global store slice) : loads + decrypts the
 * `hrt-admin-logs` collection via the typed client, exposes the
 * entries newest-first plus create / update / remove.
 *
 * Owned by `HrtPage` and passed down to the views since audit
 * 2026-06 — each consumer used to instantiate its own copy, so the
 * same collection was listed 2-3× per module mount and once more on
 * every sub-view switch. Mutations apply the server response
 * locally (the create/update responses ARE the fresh records) ;
 * `reload` is exposed for the cases where rows were created
 * out-of-band (schedule materialisation).
 */
import { useCallback, useEffect, useState } from 'react';

import type { HrtAdminLogPayload } from '@nodea/shared';
import { hrtAdminLogsClient } from '@/core/api/modules/hrt';
import { useModuleClient } from '@/core/modules/use-module-client';
import type { LoadState } from '@/core/types/load-state';
import { useI18n } from '@/i18n/I18nProvider.jsx';

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
  /** Full re-fetch — for rows created out-of-band (materialisation). */
  reload: () => void;
}

export function useHrtAdminLogs(): UseHrtAdminLogs {
  const { t } = useI18n();
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
          err instanceof Error ? err.message : t('hrt.load.failed');
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, version, t]);

  const create = useCallback(
    async (payload: HrtAdminLogPayload) => {
      if (!ctx) return;
      const created = await hrtAdminLogsClient.create(
        ctx.moduleUserId,
        ctx.mainKey,
        payload,
      );
      // The create response IS the new record — insert it sorted
      // instead of re-fetching the whole collection (audit 2026-06).
      setEntries((prev) => {
        const next = [{ id: created.id, payload: created.payload }, ...prev];
        next.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
        return next;
      });
    },
    [ctx],
  );

  const update = useCallback(
    async (id: string, payload: HrtAdminLogPayload) => {
      if (!ctx) return;
      const updated = await hrtAdminLogsClient.update(
        ctx.moduleUserId,
        ctx.mainKey,
        id,
        payload,
      );
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.id === id ? { id, payload: updated.payload } : e,
        );
        next.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
        return next;
      });
    },
    [ctx],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!ctx) return;
      // Optimistic removal — drop the row immediately ; success
      // needs no reconciliation, failure re-fetches to restore truth.
      setEntries((prev) => prev.filter((e) => e.id !== id));
      try {
        await hrtAdminLogsClient.remove(ctx.moduleUserId, ctx.mainKey, id);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('hrt: delete failed', err);
        reload();
      }
    },
    [ctx, reload],
  );

  return { entries, load, ready: !!ctx, create, update, remove, reload };
}
