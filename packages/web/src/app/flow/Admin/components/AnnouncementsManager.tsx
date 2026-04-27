import { useEffect, useState, type FormEvent } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';

import {
  apiAdminListAnnouncements,
  apiAdminCreateAnnouncement,
  apiAdminUpdateAnnouncement,
  apiAdminDeleteAnnouncement,
  isApiError,
} from '@/core/api/client';
import type { AnnouncementResponse } from '@nodea/shared';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';

const INITIAL_FORM = { title: '', body: '' };

/**
 * Announcements panel — Direction K · Sauge.
 *
 * Wires to `/admin/announcements` (CRUD) with plaintext content —
 * the one admin-curated surface that is intentionally NOT E2E
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
    <div className="divide-y divide-hair">
      {/* New announcement form */}
      <form onSubmit={onSubmit} className="py-[24px] first:pt-0 last:pb-0">
        <h3 className="mb-2 text-[16px] font-semibold text-ink">
          Nouvelle annonce
        </h3>

        <div className="space-y-2.5">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            maxLength={200}
            placeholder="Titre"
            aria-label="Titre"
            className="block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            rows={4}
            placeholder="Message"
            aria-label="Message"
            className="block w-full rounded-md border border-hair bg-bg px-3 py-2 text-[13px] leading-[1.55] text-ink transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-muted">
            Publiée immédiatement sur la page d’accueil — visible par tout le monde.
          </p>
          <Button type="submit" variant="primary" size="md" disabled={!canSubmit}>
            {saving ? 'Publication…' : 'Publier'}
          </Button>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
          >
            {error}
          </p>
        ) : null}
      </form>

      {/* Existing announcements list */}
      <div className="py-[24px] first:pt-0 last:pb-0">
        <h3 className="mb-2 text-[16px] font-semibold text-ink">
          Annonces existantes
        </h3>
        {loading ? (
          <p className="border-b border-hair py-6 text-[13px] italic text-muted">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="border-b border-hair py-6 text-[13px] italic text-muted">
            Aucune annonce publiée.
          </p>
        ) : (
          <ul className="flex flex-col">
            {items.map((row) => (
              <li
                key={row.id}
                className={cn(
                  'border-b border-hair py-3.5 last:border-b-0',
                  !row.active && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-[14.5px] font-medium text-ink">{row.title}</h4>
                    <p className="mt-0.5 text-[11px] uppercase tracking-[0.04em] text-muted">
                      {new Date(row.createdAt).toLocaleString('fr-FR')} ·{' '}
                      {row.active ? 'actif' : 'inactif'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="neutral"
                      size="xs"
                      onClick={() => void toggleActive(row)}
                    >
                      {row.active ? 'Désactiver' : 'Activer'}
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="sm"
                      iconOnly
                      onClick={() => void handleDelete(row.id)}
                      aria-label="Supprimer"
                      title="Supprimer"
                    >
                      <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.55] text-ink-soft">
                  {row.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
