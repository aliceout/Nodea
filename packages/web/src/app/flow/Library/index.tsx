import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Subheader from '@/ui/layout/headers/Subheader';
import {
  libraryItemsClient,
  libraryReviewsClient,
} from '@/core/api/modules/library';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import {
  LIBRARY_TYPE_VALUES,
  LIBRARY_STATUS_VALUES,
  type LibraryItemPayload,
  type LibraryReviewPayload,
} from '@nodea/shared';

type LibItem = DecryptedRecord<LibraryItemPayload>;
type LibReview = DecryptedRecord<LibraryReviewPayload>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Library module (items + reviews on one page).
 *
 * Top: add a work (book/movie/tv/doc) with title + type + status.
 * Middle: list of works with their reviews count, inline "+ fiche" to
 * create a review, delete. Bottom: recent reviews.
 */
export default function LibraryPage() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const itemsSid = modules['library-items']?.moduleUserId ?? null;
  const reviewsSid = modules['library-reviews']?.moduleUserId ?? null;

  const [items, setItems] = useState<LibItem[]>([]);
  const [reviews, setReviews] = useState<LibReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New item form
  const [title, setTitle] = useState('');
  const [type, setType] = useState<LibraryItemPayload['type']>('book');
  const [status, setStatus] = useState<LibraryItemPayload['status']>('planned');
  const [saving, setSaving] = useState(false);

  // Inline review form state (keyed by item id)
  const [openReviewFor, setOpenReviewFor] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const refresh = useCallback(async () => {
    if (!mainKey || !itemsSid || !reviewsSid) return;
    setError(null);
    try {
      const [is, rs] = await Promise.all([
        libraryItemsClient.list(itemsSid, mainKey),
        libraryReviewsClient.list(reviewsSid, mainKey),
      ]);
      is.sort((a, b) => a.payload.title.localeCompare(b.payload.title));
      rs.sort((a, b) => b.payload.date.localeCompare(a.payload.date));
      setItems(is);
      setReviews(rs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [mainKey, itemsSid, reviewsSid]);

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
      await libraryItemsClient.create(itemsSid, mainKey, {
        type,
        title: title.trim(),
        creators: [],
        status,
        tags: [],
      });
      setTitle('');
      await refresh();
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSaving(false);
    }
  }

  async function addReview(itemId: string): Promise<void> {
    if (!mainKey || !reviewsSid) return;
    if (!reviewNote.trim()) return;
    try {
      await libraryReviewsClient.create(reviewsSid, mainKey, {
        date: today(),
        item_rid: itemId,
        note: reviewNote.trim(),
      });
      setReviewNote('');
      setOpenReviewFor(null);
      await refresh();
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : ''));
    }
  }

  async function deleteItem(id: string): Promise<void> {
    if (!mainKey || !itemsSid) return;
    if (!window.confirm("Supprimer cette œuvre ? (les fiches associées restent)")) return;
    await libraryItemsClient.remove(itemsSid, mainKey, id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function deleteReview(id: string): Promise<void> {
    if (!mainKey || !reviewsSid) return;
    await libraryReviewsClient.remove(reviewsSid, mainKey, id);
    setReviews((prev) => prev.filter((r) => r.id !== id));
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
  if (!itemsSid || !reviewsSid) {
    return (
      <>
        <Subheader />
        <p className="py-8 text-center text-sm opacity-70">
          Active le module Library dans les paramètres pour commencer.
        </p>
      </>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50 transition-colors dark:bg-slate-950">
      <Subheader />
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
        <section className="space-y-3 rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Ajouter une œuvre</h2>
          <form onSubmit={createItem} className="space-y-3">
            <input
              type="text"
              placeholder="Titre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-slate-300 p-2"
            />
            <div className="flex gap-3">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as LibraryItemPayload['type'])}
                className="flex-1 rounded border border-slate-300 p-2"
              >
                {LIBRARY_TYPE_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LibraryItemPayload['status'])}
                className="flex-1 rounded border border-slate-300 p-2"
              >
                {LIBRARY_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s}
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
          <h2 className="text-lg font-semibold">Ma bibliothèque</h2>
          {loading ? (
            <p className="opacity-60">Chargement…</p>
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : items.length === 0 ? (
            <p className="opacity-60">Aucune œuvre pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => {
                const itemReviews = reviews.filter((r) => r.payload.item_rid === it.id);
                return (
                  <li
                    key={it.id}
                    className="space-y-2 rounded border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium">{it.payload.title}</p>
                        <p className="text-xs opacity-60">
                          {it.payload.type} · {it.payload.status} · {itemReviews.length}{' '}
                          {itemReviews.length > 1 ? 'fiches' : 'fiche'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenReviewFor(openReviewFor === it.id ? null : it.id)
                        }
                        className="rounded bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        + fiche
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(it.id)}
                        className="rounded p-1 text-xs text-red-600 hover:bg-red-50"
                        aria-label="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                    {openReviewFor === it.id ? (
                      <div className="space-y-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                        <textarea
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          rows={3}
                          placeholder="Note / ressenti / extrait…"
                          className="w-full rounded border border-slate-300 p-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => addReview(it.id)}
                          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          disabled={!reviewNote.trim()}
                        >
                          Ajouter la fiche
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {reviews.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Fiches récentes</h2>
            <ul className="space-y-1 text-sm">
              {reviews.slice(0, 15).map((r) => {
                const item = items.find((i) => i.id === r.payload.item_rid);
                return (
                  <li key={r.id} className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="opacity-60">
                        {r.payload.date} · {item?.payload.title ?? '(supprimée)'}
                      </p>
                      <p className="text-sm">{r.payload.note}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteReview(r.id)}
                      className="shrink-0 rounded p-0.5 text-xs text-red-600 hover:bg-red-50"
                      aria-label="Supprimer la fiche"
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
