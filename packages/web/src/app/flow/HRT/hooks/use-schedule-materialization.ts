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
 *
 * Cross-tab safe via the Web Locks API (audit 2026-06). The `running`
 * ref only guards one React tree — two TABS (or two windows) used to
 * run LIST → compute → createMany concurrently, and since the server
 * can't dedupe encrypted blobs, the window between the LIST and the
 * POST produced duplicate occurrences (the reason the DedupPanel
 * exists). `navigator.locks` serialises the pass across every tab of
 * the same origin ; the second tab waits, re-LISTs, finds the dates
 * covered and writes nothing. Two *devices* can still race — that gap
 * is structural (no shared lock) and stays covered by the DedupPanel.
 */
import { useEffect, useRef } from 'react';

import { hrtAdminLogsClient, hrtSchedulesClient } from '@/core/api/modules/hrt';
import { useModuleClient } from '@/core/modules/use-module-client';

import { computeOccurrences } from '../lib/materialize';
import { todayIso } from '../lib/labels';
import type { ScheduleEntry } from './use-schedules';

const MATERIALIZE_LOCK = 'nodea:hrt:materialize';

/** Run `fn` under a cross-tab exclusive lock when the Web Locks API
 *  is available (every supported browser ships it ; the fallback is
 *  the pre-audit behaviour, single-tab safety only). */
async function withCrossTabLock(fn: () => Promise<void>): Promise<void> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    // `await` flattens the lib's `Promise<Promise<void>>` inference.
    await navigator.locks.request(MATERIALIZE_LOCK, fn);
    return;
  }
  await fn();
}

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
        void withCrossTabLock(async () => {
          try {
            // Belt-and-suspenders against a stale `materializedThrough` :
            // we load the admin logs once and build a per-schedule set
            // of dates already covered, then filter `plan.dates` so a
            // partial run that left the schedule's bookkeeping out of
            // sync can't re-create duplicates on the next mount.
            //
            // Cost : one extra LIST call per HRT mount. Acceptable —
            // the views below load the same data anyway, and the cost
            // is dwarfed by what we save on schedules that no longer
            // re-issue hundreds of POSTs against the rate-limit.
            const existingLogs = await hrtAdminLogsClient.list(
              ctx.moduleUserId,
              ctx.mainKey,
            );
            const coveredByScheduleId = new Map<string, Set<string>>();
            for (const log of existingLogs) {
              const sid = log.payload.scheduleId;
              if (!sid) continue;
              const dates =
                coveredByScheduleId.get(sid) ?? new Set<string>();
              dates.add(log.payload.date);
              coveredByScheduleId.set(sid, dates);
            }

            for (const { entry, plan } of plans) {
              const alreadyCovered =
                coveredByScheduleId.get(entry.id) ?? new Set<string>();
              const datesToCreate = plan.dates.filter(
                (d) => !alreadyCovered.has(d),
              );

              // `now` captured once per schedule so every occurrence
              // produced by the same pass shares the same `updatedAt`
              // — matches the schedule's own `updatedAt` bump below.
              const now = new Date().toISOString();

              if (datesToCreate.length > 0) {
                // One bulk POST + one promote-guards per chunk of
                // BULK_MAX_ENTRIES inside `createMany`, instead of the
                // old per-row create that ran 2 round-trips per
                // occurrence and routinely tripped the 600/min
                // single-create rate-limit on multi-month back-fills
                // (cf. the « 32 s HRT load + 429s in the network
                // panel » incident).
                const payloads = datesToCreate.map((date) => ({
                  date,
                  time: entry.payload.time,
                  product: entry.payload.product,
                  dose: entry.payload.dose,
                  notes: entry.payload.notes,
                  scheduleId: entry.id,
                  updatedAt: now,
                }));
                await hrtAdminLogsClient.createMany(
                  ctx.moduleUserId,
                  ctx.mainKey,
                  payloads,
                );
              }
              // Always advance `materializedThrough` even when nothing
              // was created : the cached `coveredByScheduleId` already
              // proved every plan date exists, so the schedule's
              // bookkeeping is allowed to catch up.
              await hrtSchedulesClient.update(ctx.moduleUserId, ctx.mainKey, entry.id, {
                ...entry.payload,
                materializedThrough: plan.materializedThrough,
                updatedAt: now,
              });
            }
            if (mounted.current) onMaterialized();
          } catch (err) {
            if (import.meta.env.DEV) console.warn('hrt: schedule materialisation failed', err);
          } finally {
            running.current = false;
          }
        });
      }
    }

    return () => {
      mounted.current = false;
    };
  }, [ctx, ready, schedules, onMaterialized]);
}
