import { useCallback, useEffect, useState } from 'react';
import { goalsClient } from '@/core/api/modules/goals';
import type { GoalsPayload } from '@nodea/shared';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';

type GoalsRecord = DecryptedRecord<GoalsPayload>;

export default function GoalsHistoryView() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules.goals?.moduleUserId ?? null;

  const [entries, setEntries] = useState<GoalsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mainKey || !moduleUserId) return;
    setError(null);
    try {
      const list = await goalsClient.list(moduleUserId, mainKey);
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
    const ok = window.confirm('Supprimer cet objectif ?');
    if (!ok) return;
    try {
      await goalsClient.remove(moduleUserId, mainKey, id);
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
        Active le module Goals dans les paramètres pour commencer.
      </p>
    );
  }
  if (loading) return <p className="py-8 text-center opacity-60">Chargement…</p>;
  if (error) return <p className="py-8 text-center text-red-600">{error}</p>;

  if (entries.length === 0) {
    return <p className="py-8 text-center opacity-60">Aucun objectif pour le moment.</p>;
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
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                {entry.payload.status}
              </span>
              <span className="font-medium">{entry.payload.title}</span>
              {entry.payload.thread ? (
                <span className="text-xs opacity-60">#{entry.payload.thread}</span>
              ) : null}
            </div>
            {entry.payload.date ? (
              <p className="text-xs opacity-60">{entry.payload.date}</p>
            ) : null}
            {entry.payload.note ? (
              <p className="text-sm opacity-80">{entry.payload.note}</p>
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
