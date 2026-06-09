/**
 * HRT · Schedules — data hook for the recurring-dose schedules
 * (`hrt-schedules`).
 *
 * Same shape as the other HRT hooks (load + decrypt + CRUD that re-fetch)
 * plus an exposed `reload` — the materialisation engine creates occurrence
 * entries out-of-band and bumps `materializedThrough`, then asks both this
 * hook and the journal to refresh. Sorted by start date, newest first.
 */
import { useCallback, useEffect, useState } from 'react';

import type { HrtSchedulePayload } from '@nodea/shared';
import { hrtSchedulesClient } from '@/core/api/modules/hrt';
import { useModuleClient } from '@/core/modules/use-module-client';
import type { LoadState } from '@/core/types/load-state';
import { useI18n } from '@/i18n/I18nProvider.jsx';

export interface ScheduleEntry {
  id: string;
  payload: HrtSchedulePayload;
}

export interface UseHrtSchedules {
  entries: ReadonlyArray<ScheduleEntry>;
  load: LoadState;
  ready: boolean;
  reload: () => void;
  create: (payload: HrtSchedulePayload) => Promise<void>;
  update: (id: string, payload: HrtSchedulePayload) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useHrtSchedules(): UseHrtSchedules {
  const { t } = useI18n();
  const ctx = useModuleClient('hrt');
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!ctx) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    hrtSchedulesClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((records) => {
        if (cancelled) return;
        const next = records
          .map((r) => ({ id: r.id, payload: r.payload }))
          .sort((a, b) => b.payload.startDate.localeCompare(a.payload.startDate));
        setEntries(next);
        setLoad({ status: 'ready' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoad({ status: 'error', message: err instanceof Error ? err.message : t('hrt.load.failed') });
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, version, t]);

  const create = useCallback(
    async (payload: HrtSchedulePayload) => {
      if (!ctx) return;
      await hrtSchedulesClient.create(ctx.moduleUserId, ctx.mainKey, payload);
      reload();
    },
    [ctx, reload],
  );

  const update = useCallback(
    async (id: string, payload: HrtSchedulePayload) => {
      if (!ctx) return;
      await hrtSchedulesClient.update(ctx.moduleUserId, ctx.mainKey, id, payload);
      reload();
    },
    [ctx, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!ctx) return;
      setEntries((prev) => prev.filter((e) => e.id !== id));
      try {
        await hrtSchedulesClient.remove(ctx.moduleUserId, ctx.mainKey, id);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('hrt: schedule delete failed', err);
      }
      reload();
    },
    [ctx, reload],
  );

  return { entries, load, ready: !!ctx, reload, create, update, remove };
}
