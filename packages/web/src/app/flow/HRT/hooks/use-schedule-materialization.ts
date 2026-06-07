/**
 * HRT · schedule materialisation engine.
 *
 * Turns recurring `HrtSchedule` records into real `HrtAdminLog`
 * occurrences (each carrying the schedule's `id` as `scheduleId`). Runs
 * whenever the loaded schedules change and is **idempotent** :
 * `computeOccurrences` resumes from each schedule's `materializedThrough`,
 * so a date is never created twice and once caught up the pass does
 * nothing. After a pass that wrote entries it calls `onMaterialized`,
 * letting the caller refresh the schedules + the journal (whose hooks
 * created the entries out-of-band).
 *
 * Why here, once at module level : the occurrences must exist regardless
 * of which sub-view is open, so the generator lives in `HrtPage`, on the
 * **single shared** schedules instance — that's what makes creating a
 * series back-fill immediately.
 *
 * StrictMode-safe by design. In dev React mounts → unmounts → remounts,
 * double-invoking effects. We must NOT cancel the in-flight writes (that
 * would abort the back-fill on the throwaway first mount and the guard
 * would then skip the real run) : instead the `running` ref makes the
 * second invocation a no-op while the first pass completes, idempotency
 * covers any overlap, and a `mounted` ref gates the final `onMaterialized`
 * so we never refresh after a *real* unmount.
 */
import { useEffect, useRef } from 'react';

import { hrtAdminLogsClient, hrtSchedulesClient } from '@/core/api/modules/hrt';
import { useModuleClient } from '@/core/modules/use-module-client';

import { computeOccurrences } from '../lib/materialize';
import { todayIso } from '../lib/labels';
import type { ScheduleEntry } from './use-schedules';

const CHUNK = 16;

export function useScheduleMaterialization(
  schedules: ReadonlyArray<ScheduleEntry>,
  ready: boolean,
  onMaterialized: () => void,
): void {
  const ctx = useModuleClient('hrt');
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (ctx && ready && !running.current) {
      const today = todayIso();
      const plans = schedules
        .map((s) => ({ entry: s, plan: computeOccurrences(s.payload, today) }))
        .filter((p) => p.plan.dates.length > 0);

      if (plans.length > 0) {
        running.current = true;
        void (async () => {
          try {
            for (const { entry, plan } of plans) {
              for (let i = 0; i < plan.dates.length; i += CHUNK) {
                await Promise.all(
                  plan.dates.slice(i, i + CHUNK).map((date) =>
                    hrtAdminLogsClient.create(ctx.moduleUserId, ctx.mainKey, {
                      date,
                      time: entry.payload.time,
                      product: entry.payload.product,
                      dose: entry.payload.dose,
                      notes: entry.payload.notes,
                      scheduleId: entry.id,
                      updatedAt: new Date().toISOString(),
                    }),
                  ),
                );
              }
              await hrtSchedulesClient.update(ctx.moduleUserId, ctx.mainKey, entry.id, {
                ...entry.payload,
                materializedThrough: plan.materializedThrough,
                updatedAt: new Date().toISOString(),
              });
            }
            if (mounted.current) onMaterialized();
          } catch (err) {
            if (import.meta.env.DEV) console.warn('hrt: schedule materialisation failed', err);
          } finally {
            running.current = false;
          }
        })();
      }
    }

    return () => {
      mounted.current = false;
    };
  }, [ctx, ready, schedules, onMaterialized]);
}
