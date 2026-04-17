import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Subheader from '@/ui/layout/headers/Subheader';
import { reviewClient } from '@/core/api/modules/review';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { ReviewPayload } from '@nodea/shared';

type ReviewRecord = DecryptedRecord<ReviewPayload>;

/**
 * Review module (YearCompass-inspired yearly retrospective).
 *
 * MVP form: year + three free-text fields aggregated under
 * `last_year` / `next_year` / `closing`. Matches the documentation's
 * top-level shape, kept loose on purpose — the deep nested structure
 * (life_areas, six_phrases, triplets…) comes later as a guided tour.
 */
export default function ReviewPage() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const sid = modules.review?.moduleUserId ?? null;

  const [entries, setEntries] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [lastYearText, setLastYearText] = useState('');
  const [nextYearText, setNextYearText] = useState('');
  const [closingText, setClosingText] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!mainKey || !sid) return;
    setError(null);
    try {
      const list = await reviewClient.list(sid, mainKey);
      list.sort((a, b) => b.payload.year - a.payload.year);
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [mainKey, sid]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!mainKey || !sid) return;
    setSaving(true);
    try {
      await reviewClient.create(sid, mainKey, {
        year,
        last_year: lastYearText ? { notes: lastYearText } : {},
        next_year: nextYearText ? { notes: nextYearText } : {},
        closing: closingText ? { notes: closingText } : {},
      });
      setLastYearText('');
      setNextYearText('');
      setClosingText('');
      await refresh();
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSaving(false);
    }
  }

  async function deleteReview(id: string): Promise<void> {
    if (!mainKey || !sid) return;
    if (!window.confirm('Supprimer ce bilan annuel ?')) return;
    await reviewClient.remove(sid, mainKey, id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
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
  if (!sid) {
    return (
      <>
        <Subheader />
        <p className="py-8 text-center text-sm opacity-70">
          Active le module Review dans les paramètres pour commencer.
        </p>
      </>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50 transition-colors dark:bg-slate-950">
      <Subheader />
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
        <section className="space-y-3 rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Nouveau bilan annuel</h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="text-sm">Année</span>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={1900}
                max={2200}
                className="mt-1 block w-32 rounded border border-slate-300 p-2"
              />
            </label>

            <label className="block">
              <span className="text-sm">Année qui se termine</span>
              <textarea
                value={lastYearText}
                onChange={(e) => setLastYearText(e.target.value)}
                rows={5}
                placeholder="Bilan, réussites, défis, apprentissages…"
                className="mt-1 block w-full rounded border border-slate-300 p-2"
              />
            </label>

            <label className="block">
              <span className="text-sm">Année à venir</span>
              <textarea
                value={nextYearText}
                onChange={(e) => setNextYearText(e.target.value)}
                rows={5}
                placeholder="Intentions, rêves, objectifs, mot-clé de l'année…"
                className="mt-1 block w-full rounded border border-slate-300 p-2"
              />
            </label>

            <label className="block">
              <span className="text-sm">Clôture</span>
              <textarea
                value={closingText}
                onChange={(e) => setClosingText(e.target.value)}
                rows={4}
                placeholder="Lettre à soi, engagement, signature…"
                className="mt-1 block w-full rounded border border-slate-300 p-2"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer le bilan'}
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Bilans précédents</h2>
          {loading ? (
            <p className="opacity-60">Chargement…</p>
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : entries.length === 0 ? (
            <p className="opacity-60">Aucun bilan pour le moment.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((e) => {
                const ly = (e.payload.last_year ?? {}) as Record<string, unknown>;
                const ny = (e.payload.next_year ?? {}) as Record<string, unknown>;
                const cl = (e.payload.closing ?? {}) as Record<string, unknown>;
                const lyNotes = typeof ly.notes === 'string' ? ly.notes : '';
                const nyNotes = typeof ny.notes === 'string' ? ny.notes : '';
                const clNotes = typeof cl.notes === 'string' ? cl.notes : '';
                return (
                  <li
                    key={e.id}
                    className="space-y-2 rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold">Bilan {e.payload.year}</h3>
                      <button
                        type="button"
                        onClick={() => deleteReview(e.id)}
                        className="rounded p-1 text-xs text-red-600 hover:bg-red-50"
                        aria-label="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                    {lyNotes ? (
                      <div>
                        <p className="text-xs font-semibold uppercase opacity-60">
                          Année écoulée
                        </p>
                        <p className="whitespace-pre-wrap text-sm">{lyNotes}</p>
                      </div>
                    ) : null}
                    {nyNotes ? (
                      <div>
                        <p className="text-xs font-semibold uppercase opacity-60">Année à venir</p>
                        <p className="whitespace-pre-wrap text-sm">{nyNotes}</p>
                      </div>
                    ) : null}
                    {clNotes ? (
                      <div>
                        <p className="text-xs font-semibold uppercase opacity-60">Clôture</p>
                        <p className="whitespace-pre-wrap text-sm">{clNotes}</p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
