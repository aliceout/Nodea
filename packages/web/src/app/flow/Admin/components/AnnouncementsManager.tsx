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
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useConfirm } from '@/ui/dirk/confirm/confirm-context';
import Button from '@/ui/atoms/dirk/Button';
import DirkInput from '@/ui/atoms/dirk/Input';
import EmptyHint from '@/ui/dirk/module/EmptyHint';

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
  const { t, language } = useI18n();
  const confirm = useConfirm();
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
        setError(
          err instanceof Error
            ? err.message
            : t('admin.announcementsManager.errors.loadFailed'),
        );
        if (isApiError(err) && import.meta.env.DEV) console.warn('list announcements failed', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

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
      setError(
        err instanceof Error
          ? err.message
          : t('admin.announcementsManager.errors.publishFailed'),
      );
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
      setError(
        err instanceof Error
          ? err.message
          : t('admin.announcementsManager.errors.updateFailed'),
      );
    }
  }

  async function handleDelete(id: string): Promise<void> {
    const ok = await confirm({
      message: t('admin.announcementsManager.confirmDelete'),
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    try {
      await apiAdminDeleteAnnouncement(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.announcementsManager.errors.deleteFailed'),
      );
    }
  }

  return (
    <div className="divide-y divide-hair">
      {/* New announcement form */}
      <form onSubmit={onSubmit} className="py-[24px] first:pt-0 last:pb-0">
        <h3 className="mb-2 text-[16px] font-semibold text-ink">
          {t('admin.announcementsManager.newHeading')}
        </h3>

        <div className="space-y-2.5">
          <DirkInput
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            maxLength={200}
            placeholder={t('admin.announcementsManager.titlePlaceholder')}
            aria-label={t('admin.announcementsManager.titleAria')}
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            rows={4}
            placeholder={t('admin.announcementsManager.messagePlaceholder')}
            aria-label={t('admin.announcementsManager.messageAria')}
            className="block w-full rounded-md border border-hair bg-bg px-3 py-2 text-[13px] leading-[1.55] text-ink transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-muted">
            {t('admin.announcementsManager.publishHint')}
          </p>
          <Button type="submit" variant="primary" size="sm" disabled={!canSubmit}>
            {saving
              ? t('admin.announcementsManager.publishing')
              : t('admin.announcementsManager.publish')}
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
          {t('admin.announcementsManager.existingHeading')}
        </h3>
        {loading ? (
          <EmptyHint>{t('admin.announcementsManager.loading')}</EmptyHint>
        ) : items.length === 0 ? (
          <EmptyHint>{t('admin.announcementsManager.empty')}</EmptyHint>
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
                      {new Date(row.createdAt).toLocaleString(language)} ·{' '}
                      {row.active
                        ? t('admin.announcementsManager.active')
                        : t('admin.announcementsManager.inactive')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="neutral"
                      size="xs"
                      onClick={() => void toggleActive(row)}
                    >
                      {row.active
                        ? t('admin.announcementsManager.deactivate')
                        : t('admin.announcementsManager.activate')}
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="sm"
                      iconOnly
                      onClick={() => void handleDelete(row.id)}
                      aria-label={t('admin.announcementsManager.deleteAria')}
                      title={t('admin.announcementsManager.deleteTitle')}
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
