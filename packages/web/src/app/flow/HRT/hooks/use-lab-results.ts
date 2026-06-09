/**
 * HRT · Analyses — data hook for lab marker readings.
 *
 * Mirror of `use-admin-logs` for the `hrt-lab-results` collection :
 * loads + decrypts, exposes entries sorted oldest-first (the chart
 * reads left-to-right in time), and create / update / remove that
 * re-fetch on success.
 */
import { useCallback, useEffect, useState } from 'react';

import type { HrtLabResultPayload } from '@nodea/shared';
import { hrtLabResultsClient } from '@/core/api/modules/hrt';
import { useModuleClient } from '@/core/modules/use-module-client';
import type { LoadState } from '@/core/types/load-state';
import { useI18n } from '@/i18n/I18nProvider.jsx';

export interface LabResultEntry {
  id: string;
  payload: HrtLabResultPayload;
}

export interface UseHrtLabResults {
  entries: ReadonlyArray<LabResultEntry>;
  load: LoadState;
  ready: boolean;
  create: (payload: HrtLabResultPayload) => Promise<void>;
  update: (id: string, payload: HrtLabResultPayload) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useHrtLabResults(): UseHrtLabResults {
  const { t } = useI18n();
  const ctx = useModuleClient('hrt');
  const [entries, setEntries] = useState<LabResultEntry[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!ctx) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    hrtLabResultsClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((records) => {
        if (cancelled) return;
        const next = records
          .map((r) => ({ id: r.id, payload: r.payload }))
          // Oldest-first : the chart plots time left → right.
          .sort((a, b) => a.payload.date.localeCompare(b.payload.date));
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
    async (payload: HrtLabResultPayload) => {
      if (!ctx) return;
      await hrtLabResultsClient.create(ctx.moduleUserId, ctx.mainKey, payload);
      reload();
    },
    [ctx, reload],
  );

  const update = useCallback(
    async (id: string, payload: HrtLabResultPayload) => {
      if (!ctx) return;
      await hrtLabResultsClient.update(ctx.moduleUserId, ctx.mainKey, id, payload);
      reload();
    },
    [ctx, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!ctx) return;
      setEntries((prev) => prev.filter((e) => e.id !== id));
      try {
        await hrtLabResultsClient.remove(ctx.moduleUserId, ctx.mainKey, id);
        reload();
      } catch (err) {
        if (import.meta.env.DEV) console.warn('hrt: lab delete failed', err);
        reload();
      }
    },
    [ctx, reload],
  );

  return { entries, load, ready: !!ctx, create, update, remove };
}
