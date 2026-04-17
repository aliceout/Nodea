import { useCallback, useEffect, useState } from 'react';
import { moodClient } from '@/core/api/modules/mood';
import type { MoodPayload } from '@nodea/shared';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';

type MoodRecord = DecryptedRecord<MoodPayload>;

/**
 * Decrypted list of Mood entries with per-row delete.
 *
 * The list-and-decrypt round-trip is backed by the generic
 * `createCollectionClient` → sure, every payload parse is a Zod run,
 * but the data volume is tiny (one entry per day at most) and that
 * keeps the server contract honest.
 */
export default function MoodHistoryView() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules.mood?.moduleUserId ?? null;

  const [entries, setEntries] = useState<MoodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mainKey || !moduleUserId) return;
    setError(null);
    try {
      const list = await moodClient.list(moduleUserId, mainKey);
      list.sort((a, b) => b.payload.date.localeCompare(a.payload.date));
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [mainKey, moduleUserId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  async function onDelete(id: string): Promise<void> {
    if (!mainKey || !moduleUserId) return;
    const ok = window.confirm('Supprimer cette entrée ?');
    if (!ok) return;
    try {
      await moodClient.remove(moduleUserId, mainKey, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : ''));
    }
  }

  if (!mainKey) {
    return (
      <p className="py-8 text-center text-sm text-red-600">
        Clé principale absente — reconnecte-toi.
      </p>
    );
  }
  if (!moduleUserId) {
    return (
      <p className="py-8 text-center text-sm opacity-70">
        Active le module Mood dans les paramètres pour commencer.
      </p>
    );
  }
  if (loading) return <p className="py-8 text-center opacity-60">Chargement…</p>;
  if (error) return <p className="py-8 text-center text-red-600">{error}</p>;

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center opacity-60">Aucune entrée pour le moment.</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3 py-6">
      {entries.map((entry) => (
        <article
          key={entry.id}
          className="flex items-start justify-between gap-4 rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-2xl">{entry.payload.mood_emoji}</span>
              <span className="font-medium">{entry.payload.date}</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                {entry.payload.mood_score} / 10
              </span>
            </div>
            {entry.payload.comment ? (
              <p className="text-sm opacity-80">{entry.payload.comment}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            className="shrink-0 rounded p-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            aria-label="Supprimer"
          >
            ✕
          </button>
        </article>
      ))}
    </div>
  );
}
