import useLatestAnnouncement from '../hooks/useLatestAnnouncement';
import { useI18n } from '@/i18n/I18nProvider.jsx';

/**
 * Homepage spotlight for the latest admin announcement.
 *
 * Renders nothing until the announcements back-end is wired (R10 / #19).
 * When it lands, this component picks up the new endpoint without a
 * code change — see `useLatestAnnouncement` for the fallback contract.
 */
export default function AnnouncementSpotlight() {
  const { status, announcement } = useLatestAnnouncement();
  const { t } = useI18n();

  if (status === 'ready' && announcement) {
    const title =
      announcement.title ||
      t('home.announcement.label', { defaultValue: 'Nouvelle' });
    const body = announcement.body || '';
    const dateSource = announcement.publishedAt ?? announcement.createdAt;
    let formattedDate: string | null = null;
    if (dateSource) {
      const d = new Date(dateSource);
      if (!Number.isNaN(d.getTime())) {
        formattedDate = new Intl.DateTimeFormat('fr-FR', {
          day: 'numeric',
          month: 'long',
        }).format(d);
      }
    }

    return (
      <aside className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-slate-900 bg-slate-900 p-5 text-slate-100 shadow-sm dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900">
        <p className="text-xs uppercase tracking-wide opacity-70">
          {t('home.announcement.label', { defaultValue: 'Nouvelle' })}
        </p>
        {formattedDate ? (
          <p className="text-xs opacity-70">
            {t('home.announcement.publishedOn', {
              defaultValue: 'Publié le {date}',
              values: { date: formattedDate },
            })}
          </p>
        ) : null}
        <h3 className="text-lg font-semibold">{title}</h3>
        {body ? (
          <p className="text-sm leading-relaxed opacity-90 whitespace-pre-wrap">
            {body}
          </p>
        ) : null}
      </aside>
    );
  }

  if (status === 'loading') {
    return (
      <aside className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm opacity-70 dark:border-slate-700 dark:bg-slate-900/50">
        {t('home.announcement.loading', { defaultValue: 'Chargement des nouveautés…' })}
      </aside>
    );
  }

  // `empty` (no announcement) and `error` / `idle` — silent until R10.
  return null;
}
