/**
 * HRT · Products — data hook for the product catalog.
 *
 * Same shape as the other HRT hooks (load + decrypt + CRUD that
 * re-fetch). Consumed by the Products sub-view (full CRUD) and read by
 * the Administration view (to power the product picker + the mL→mg
 * join). Sorted by name for a stable picker order.
 *
 * Backed by the `hrt-suppliers` collection (legacy wire name) via
 * `hrtProductsClient`.
 */
import { useCallback, useEffect, useState } from 'react';

import type { HrtProductPayload } from '@nodea/shared';
import { hrtProductsClient } from '@/core/api/modules/hrt';
import { useModuleClient } from '@/core/modules/use-module-client';
import type { LoadState } from '@/core/types/load-state';
import { useI18n } from '@/i18n/I18nProvider.jsx';

export interface ProductEntry {
  id: string;
  payload: HrtProductPayload;
}

export interface UseHrtProducts {
  entries: ReadonlyArray<ProductEntry>;
  load: LoadState;
  ready: boolean;
  create: (payload: HrtProductPayload) => Promise<void>;
  update: (id: string, payload: HrtProductPayload) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useHrtProducts(): UseHrtProducts {
  const { t } = useI18n();
  const ctx = useModuleClient('hrt');
  const [entries, setEntries] = useState<ProductEntry[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!ctx) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    hrtProductsClient
      .list(ctx.moduleUserId, ctx.mainKey)
      .then((records) => {
        if (cancelled) return;
        const next = records
          .map((r) => ({ id: r.id, payload: r.payload }))
          .sort((a, b) => a.payload.name.localeCompare(b.payload.name));
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
    async (payload: HrtProductPayload) => {
      if (!ctx) return;
      await hrtProductsClient.create(ctx.moduleUserId, ctx.mainKey, payload);
      reload();
    },
    [ctx, reload],
  );

  const update = useCallback(
    async (id: string, payload: HrtProductPayload) => {
      if (!ctx) return;
      await hrtProductsClient.update(ctx.moduleUserId, ctx.mainKey, id, payload);
      reload();
    },
    [ctx, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!ctx) return;
      setEntries((prev) => prev.filter((e) => e.id !== id));
      try {
        await hrtProductsClient.remove(ctx.moduleUserId, ctx.mainKey, id);
        reload();
      } catch (err) {
        if (import.meta.env.DEV) console.warn('hrt: product delete failed', err);
        reload();
      }
    },
    [ctx, reload],
  );

  return { entries, load, ready: !!ctx, create, update, remove };
}
