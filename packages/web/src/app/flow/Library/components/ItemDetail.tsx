import { useState, type FormEvent } from 'react';
import type { LibItem, LibReview } from '../hooks/useLibrary';
import type { LibraryReviewPayload } from '@nodea/shared';
import Rating from './Rating';

interface ItemDetailProps {
  item: LibItem;
  reviews: LibReview[];
  onClose(): void;
  onDelete(): void;
  onCreateReview(payload: LibraryReviewPayload): Promise<void>;
  onDeleteReview(id: string): Promise<void>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ItemDetail({
  item,
  reviews,
  onClose,
  onDelete,
  onCreateReview,
  onDeleteReview,
}: ItemDetailProps) {
  const p = item.payload;
  const itemReviews = reviews.filter((r) => r.payload.item_rid === item.id);

  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [page, setPage] = useState<string>('');
  const [snippet, setSnippet] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitReview(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!note.trim()) {
      setError('La note est requise.');
      return;
    }
    const pageNum = page.trim() ? Number(page.trim()) : undefined;
    if (pageNum != null && (!Number.isInteger(pageNum) || pageNum <= 0)) {
      setError('Page invalide.');
      return;
    }
    const payload: LibraryReviewPayload = {
      date,
      item_rid: item.id,
      note: note.trim(),
      ...(pageNum != null ? { page: pageNum } : {}),
      ...(snippet.trim() ? { snippet: snippet.trim() } : {}),
    };
    setSaving(true);
    try {
      await onCreateReview(payload);
      setNote('');
      setPage('');
      setSnippet('');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl space-y-5 rounded bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-1 gap-4">
            {p.cover_url ? (
              <img
                src={p.cover_url}
                alt=""
                className="h-32 w-22 flex-shrink-0 rounded object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : null}
            <div>
              <h2 className="text-xl font-semibold">{p.title}</h2>
              {p.creators.length > 0 ? (
                <p className="text-sm opacity-70">{p.creators.join(', ')}</p>
              ) : null}
              <p className="mt-1 text-xs opacity-60">
                {p.type}
                {p.year ? ` · ${p.year}` : ''}
                {p.language ? ` · ${p.language}` : ''}
                {' · '}
                {p.status}
              </p>
              {p.rating != null ? (
                <div className="mt-1">
                  <Rating value={p.rating} readOnly size="sm" />
                </div>
              ) : null}
              {p.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded p-1 text-lg opacity-60 hover:bg-slate-100 hover:opacity-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </header>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Fiches de lecture</h3>
          {itemReviews.length === 0 ? (
            <p className="text-sm opacity-60">Aucune fiche pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {itemReviews.map((r) => (
                <li
                  key={r.id}
                  className="rounded border border-slate-200 p-3 text-sm dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs opacity-60">
                      {r.payload.date}
                      {r.payload.page ? ` · p. ${r.payload.page}` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => void onDeleteReview(r.id)}
                      aria-label="Supprimer la fiche"
                      className="rounded p-0.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{r.payload.note}</p>
                  {r.payload.snippet ? (
                    <blockquote className="mt-2 border-l-2 border-slate-300 pl-2 text-xs italic opacity-80">
                      {r.payload.snippet}
                    </blockquote>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={submitReview} className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold">Nouvelle fiche</h3>
          <div className="flex gap-3">
            <label className="flex-1 block">
              <span className="text-xs">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
              />
            </label>
            <label className="flex-1 block">
              <span className="text-xs">Page (optionnel)</span>
              <input
                type="number"
                min={1}
                value={page}
                onChange={(e) => setPage(e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs">Note / réflexion</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs">Citation / extrait (optionnel)</span>
            <textarea
              value={snippet}
              onChange={(e) => setSnippet(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
            />
          </label>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={saving || !note.trim()}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Ajout…' : 'Ajouter la fiche'}
          </button>
        </form>

        <footer className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Supprimer "${p.title}" ? (les fiches restent.)`)) {
                onDelete();
              }
            }}
            className="text-xs text-red-600 hover:underline"
          >
            Supprimer l'œuvre
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
}
