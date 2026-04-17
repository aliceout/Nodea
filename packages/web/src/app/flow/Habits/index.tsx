import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Subheader from '@/ui/layout/headers/Subheader';
import { habitsItemsClient, habitsLogsClient } from '@/core/api/modules/habits';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import {
  HABIT_CATEGORY_VALUES,
  HABIT_FREQUENCY_VALUES,
  type HabitsItemPayload,
  type HabitsLogPayload,
} from '@nodea/shared';

type HabitItem = DecryptedRecord<HabitsItemPayload>;
type HabitLog = DecryptedRecord<HabitsLogPayload>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Habits module (items + logs on one page).
 *
 * Top: "new habit" form. Middle: list of habits, each with a "Log today"
 * button that creates a habits-logs entry. Bottom: recent logs list.
 *
 * The two-collection design (items + logs) is what the documentation
 * describes; it gives us a clean separation between the "what I want
 * to do" and the "what I did when".
 */
export default function HabitsPage() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const itemsSid = modules['habits-items']?.moduleUserId ?? null;
  const logsSid = modules['habits-logs']?.moduleUserId ?? null;

  const [items, setItems] = useState<HabitItem[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New-item form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<HabitsItemPayload['category']>('autre');
  const [frequency, setFrequency] = useState<HabitsItemPayload['frequency']>('weekly');
  const [saving, setSaving] = useState(false);

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

  async function createItem(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!mainKey || !itemsSid) return;
    if (!title.trim()) return;
    setSaving(true);
    try {
      await habitsItemsClient.create(itemsSid, mainKey, {
        title: title.trim(),
        category,
        frequency,
        started_at: today(),
        archived: false,
      });
      setTitle('');
      await refresh();
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSaving(false);
    }
  }

  async function logToday(item: HabitItem): Promise<void> {
    if (!mainKey || !logsSid) return;
    try {
      await habitsLogsClient.create(logsSid, mainKey, {
        date: today(),
        item_rid: item.id,
        done: true,
      });
      await refresh();
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : ''));
    }
  }

  async function deleteItem(id: string): Promise<void> {
    if (!mainKey || !itemsSid) return;
    if (!window.confirm('Supprimer cette habitude ?')) return;
    await habitsItemsClient.remove(itemsSid, mainKey, id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function deleteLog(id: string): Promise<void> {
    if (!mainKey || !logsSid) return;
    await habitsLogsClient.remove(logsSid, mainKey, id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  if (!mainKey) {
    return (
      <>
        <Subheader />
        <p className="py-8 text-center text-sm text-red-600">
          Clé principale absente — reconnecte-toi.
        </p>
      </>
    );
  }
  if (!itemsSid || !logsSid) {
    return (
      <>
        <Subheader />
        <p className="py-8 text-center text-sm opacity-70">
          Active le module Habits dans les paramètres pour commencer.
        </p>
      </>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50 transition-colors dark:bg-slate-950">
      <Subheader />
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
        <section className="space-y-3 rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Nouvelle habitude</h2>
          <form onSubmit={createItem} className="space-y-3">
            <input
              type="text"
              placeholder="Ex. Tennis"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-slate-300 p-2"
            />
            <div className="flex gap-3">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as HabitsItemPayload['category'])}
                className="flex-1 rounded border border-slate-300 p-2"
              >
                {HABIT_CATEGORY_VALUES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as HabitsItemPayload['frequency'])}
                className="flex-1 rounded border border-slate-300 p-2"
              >
                {HABIT_FREQUENCY_VALUES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Ajout…' : 'Ajouter'}
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Mes habitudes</h2>
          {loading ? (
            <p className="opacity-60">Chargement…</p>
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : items.length === 0 ? (
            <p className="opacity-60">Aucune habitude pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => {
                const logsForItem = logs.filter((l) => l.payload.item_rid === it.id);
                return (
                  <li
                    key={it.id}
                    className="flex items-center justify-between gap-4 rounded border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{it.payload.title}</p>
                      <p className="text-xs opacity-60">
                        {it.payload.category} · {it.payload.frequency} · {logsForItem.length}{' '}
                        {logsForItem.length > 1 ? 'logs' : 'log'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => logToday(it)}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Log aujourd'hui
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItem(it.id)}
                      className="rounded p-1 text-xs text-red-600 hover:bg-red-50"
                      aria-label="Supprimer"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {logs.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Derniers logs</h2>
            <ul className="space-y-1 text-sm">
              {logs.slice(0, 20).map((l) => {
                const item = items.find((i) => i.id === l.payload.item_rid);
                return (
                  <li key={l.id} className="flex items-center justify-between">
                    <span>
                      <span className="opacity-60">{l.payload.date}</span>{' '}
                      <span className="font-medium">{item?.payload.title ?? '(supprimée)'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteLog(l.id)}
                      className="rounded p-0.5 text-xs text-red-600 hover:bg-red-50"
                      aria-label="Supprimer le log"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
