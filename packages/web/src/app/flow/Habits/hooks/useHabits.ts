import { useCallback, useEffect, useMemo, useState } from 'react';
import { habitsItemsClient, habitsLogsClient } from '@/core/api/modules/habits';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { HabitsItemPayload, HabitsLogPayload } from '@nodea/shared';

export type HabitItem = DecryptedRecord<HabitsItemPayload>;
export type HabitLog = DecryptedRecord<HabitsLogPayload>;

export interface HabitsContext {
  ready: boolean;
  keyMissing: boolean;
  moduleMissing: boolean;
  loading: boolean;
  error: string | null;
  items: HabitItem[];
  logs: HabitLog[];
  refresh(): Promise<void>;
  createItem(payload: HabitsItemPayload): Promise<void>;
  updateItem(id: string, payload: HabitsItemPayload): Promise<void>;
  deleteItem(id: string): Promise<void>;
  logOccurrence(itemId: string, date: string): Promise<void>;
  deleteLog(id: string): Promise<void>;
}

/**
 * Single hook for the Habits module — owns the items + logs lists and
 * surfaces the mutation helpers the views need. Kept here (not in a
 * Zustand slice) because the data is purely local to this page.
 *
 * **Why bare `selectMainKey + selectModules` instead of
 * `useModuleClient(...)`** : two distinct reasons stack here.
 *   1. Habits is a multi-collection module : it needs both
 *      `habits-items` and `habits-logs` sids in lockstep. The
 *      `useModuleClient(moduleId)` hook is single-id by design and
 *      doesn't fit this case (a `useModuleClients(ids[])` variant
 *      would be the only tidy migration — YAGNI for one consumer).
 *   2. Like `useReview`, the views consume `keyMissing` vs
 *      `moduleMissing` separately to render different empty states.
 *      `useModuleClient` collapses both into a single `null`,
 *      losing the discriminator.
 */
export function useHabits(): HabitsContext {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const itemsSid = modules['habits-items']?.moduleUserId ?? null;
  const logsSid = modules['habits-logs']?.moduleUserId ?? null;

  const ready = Boolean(mainKey && itemsSid && logsSid);

  const [items, setItems] = useState<HabitItem[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mainKey || !itemsSid || !logsSid) return;
    setError(null);
    try {
      const [is, ls] = await Promise.all([
        habitsItemsClient.list(itemsSid, mainKey),
        habitsLogsClient.list(logsSid, mainKey),
      ]);
      is.sort((a, b) => a.payload.title.localeCompare(b.payload.title));
      ls.sort((a, b) => b.payload.date.localeCompare(a.payload.date));
      setItems(is);
      setLogs(ls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [mainKey, itemsSid, logsSid]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const createItem = useCallback(
    async (payload: HabitsItemPayload) => {
      if (!mainKey || !itemsSid) return;
      await habitsItemsClient.create(itemsSid, mainKey, payload);
      await refresh();
    },
    [mainKey, itemsSid, refresh],
  );

  const updateItem = useCallback(
    async (id: string, payload: HabitsItemPayload) => {
      if (!mainKey || !itemsSid) return;
      await habitsItemsClient.update(itemsSid, mainKey, id, payload);
      await refresh();
    },
    [mainKey, itemsSid, refresh],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (!mainKey || !itemsSid) return;
      await habitsItemsClient.remove(itemsSid, mainKey, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      // Cascade-delete the habit's logs (audit 2026-06 passe 2, 3.8).
      // The server can't cascade : `itemRid` lives inside the encrypted
      // log payload, invisible to it — so the client sweeps the logs it
      // already holds. Without this, deleting a habit left every past
      // tick as an orphan log (still counted in stats, undeletable from
      // the UI now that its parent habit is gone), contradicting the
      // « et tous ses logs » the confirm dialog promises. `allSettled`
      // so one failed delete doesn't abort the rest ; only the logs
      // that actually left the server are dropped locally.
      if (logsSid) {
        const orphanIds = logs
          .filter((l) => l.payload.itemRid === id)
          .map((l) => l.id);
        if (orphanIds.length > 0) {
          const results = await Promise.allSettled(
            orphanIds.map((logId) =>
              habitsLogsClient.remove(logsSid, mainKey, logId),
            ),
          );
          const removed = new Set(
            orphanIds.filter((_, i) => results[i]?.status === 'fulfilled'),
          );
          setLogs((prev) => prev.filter((l) => !removed.has(l.id)));
        }
      }
    },
    [mainKey, itemsSid, logsSid, logs],
  );

  const logOccurrence = useCallback(
    async (itemId: string, date: string) => {
      if (!mainKey || !logsSid) return;
      const created = await habitsLogsClient.create(logsSid, mainKey, {
        date,
        itemRid: itemId,
        done: true,
      });
      // The create response IS the new log — insert it locally
      // instead of re-fetching + re-decrypting every item and every
      // log on each tick. Checking a habit is the module's most
      // frequent action and was visibly sluggish past a few hundred
      // logs (audit 2026-06). List stays date-desc sorted.
      setLogs((prev) => {
        const next = [created, ...prev];
        next.sort((a, b) => b.payload.date.localeCompare(a.payload.date));
        return next;
      });
    },
    [mainKey, logsSid],
  );

  const deleteLog = useCallback(
    async (id: string) => {
      if (!mainKey || !logsSid) return;
      await habitsLogsClient.remove(logsSid, mainKey, id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    },
    [mainKey, logsSid],
  );

  return useMemo<HabitsContext>(
    () => ({
      ready,
      keyMissing: !mainKey,
      moduleMissing: Boolean(mainKey) && (!itemsSid || !logsSid),
      loading,
      error,
      items,
      logs,
      refresh,
      createItem,
      updateItem,
      deleteItem,
      logOccurrence,
      deleteLog,
    }),
    [
      ready,
      mainKey,
      itemsSid,
      logsSid,
      loading,
      error,
      items,
      logs,
      refresh,
      createItem,
      updateItem,
      deleteItem,
      logOccurrence,
      deleteLog,
    ],
  );
}
