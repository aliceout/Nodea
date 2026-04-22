import { useEffect, useState, type FormEvent } from 'react';
import {
  apiAdminListAnnouncements,
  apiAdminCreateAnnouncement,
  apiAdminUpdateAnnouncement,
  apiAdminDeleteAnnouncement,
  isApiError,
} from '@/core/api/client';
import type { AnnouncementResponse } from '@nodea/shared';

const INITIAL_FORM = { title: '', body: '' };

/**
 * Admin panel for the homepage announcement feed.
 *
 * Wires to `/admin/announcements` (CRUD) with plaintext content — this
 * is the one admin-curated surface that is intentionally not E2E
 * encrypted (see schema.ts). Inactive rows can be toggled back on
 * without deleting them, which preserves the audit trail.
 */
export default function AnnouncementsManager() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [items, setItems] = useState<AnnouncementResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiAdminListAnnouncements()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Impossible de charger.');
        if (isApiError(err) && import.meta.env.DEV) console.warn('list announcements failed', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = form.title.trim().length > 0 && form.body.trim().length > 0 && !saving;

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const created = await apiAdminCreateAnnouncement({
        title: form.title.trim(),
        body: form.body.trim(),
        active: true,
      });
      setItems((prev) => [created, ...prev]);
      setForm(INITIAL_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de publier.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: AnnouncementResponse): Promise<void> {
    setError(null);
    try {
      const updated = await apiAdminUpdateAnnouncement(row.id, { active: !row.active });
      setItems((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible.');
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm('Supprimer cette annonce ?')) return;
    setError(null);
    try {
      await apiAdminDeleteAnnouncement(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  return (
    <section className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
      >
        <h3 className="text-base font-semibold">Nouvelle annonce</h3>
        <label className="block">
          <span className="text-sm">Titre</span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            maxLength={200}
            placeholder="Nouveau module disponible"
            className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm">Message</span>
          <textarea
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            rows={4}
            placeholder="Nous avons ajouté…"
            className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
          />
        </label>
        <div className="flex items-center justify-between">
          <p className="text-xs opacity-60">
            Publiée immédiatement sur la page d'accueil des utilisateur·ice·s.
          </p>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            {saving ? 'Publication…' : 'Publier'}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Annonces existantes
        </h3>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm opacity-60">Chargement…</p> : null}
        {!loading && items.length === 0 ? (
          <p className="text-sm opacity-60">Aucune annonce publiée.</p>
        ) : null}
        <ul className="space-y-2">
          {items.map((row) => (
            <li
              key={row.id}
              className={
                'space-y-2 rounded border p-3 ' +
                (row.active
                  ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                  : 'border-slate-200 bg-slate-50 opacity-75 dark:border-slate-700 dark:bg-slate-800')
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold">{row.title}</h4>
                  <p className="text-xs uppercase tracking-wide opacity-60">
                    {new Date(row.createdAt).toLocaleString('fr-FR')} · {row.active ? 'actif' : 'inactif'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleActive(row)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  >
                    {row.active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(row.id)}
                    className="rounded p-1 text-xs text-red-600 hover:bg-red-50"
                    aria-label="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{row.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
