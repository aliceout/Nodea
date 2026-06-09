import { useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

import { formatLongDate } from '@/core/i18n/date-format';
import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

import { useHomepageData } from '../context';
import HomeCard from './HomeCard';

/**
 * Public announcements card on the Homepage. Lives at the top of
 * the primary column, full-width across both grid columns (via the
 * `lg:col-span-2` passthrough to `HomeCard`), so admin-pushed news
 * is read before anything else.
 *
 * Renders zero or more `AnnouncementResponse` rows, each with a
 * bold title + plaintext body + the date the row was created. The
 * body is plaintext on purpose (the schema caps it at 10 KB and
 * the admin form is a textarea) ; `whitespace-pre-line` preserves
 * the author's line breaks without enabling any markup.
 *
 * **Dismissal.** Each row carries a trailing « X » button that
 * appends its id to `preferences.dismissedAnnouncements` (an
 * encrypted user-pref blob — the server never sees which
 * announcements a specific user has interacted with). The card
 * filters dismissed ids out at render time ; once every visible
 * row has been dismissed the card returns `null` and the homepage
 * grid flows back to the personal 2×2 layout.
 *
 * The dismissed list is append-only — admins can let an
 * announcement go live again by editing it (no in-app re-show
 * affordance for the user). Long term : a « re-afficher tout »
 * action in Settings is the natural escape hatch.
 */
export default function AnnouncementsCard() {
  const { t, language } = useI18n();
  const { announcements } = useHomepageData();
  const { preferences, setPreferences } = usePreferences();

  const dismissed = useMemo(
    () => new Set(preferences.dismissedAnnouncements ?? []),
    [preferences.dismissedAnnouncements],
  );
  const visible = useMemo(
    () => announcements.filter((a) => !dismissed.has(a.id)),
    [announcements, dismissed],
  );

  if (visible.length === 0) return null;

  function dismissOne(id: string): void {
    // Optimistic-by-default : `setPreferences` updates the Zustand
    // slice synchronously then PUTs the re-encrypted blob ; the
    // filter above re-runs on the next render and the row is gone.
    const next = Array.from(new Set([...(preferences.dismissedAnnouncements ?? []), id]));
    void setPreferences({ dismissedAnnouncements: next });
  }

  return (
    <HomeCard
      title={t('home.announcements.title', { defaultValue: 'Annonces' })}
      className="lg:col-span-2"
    >
      <ul className="flex flex-col divide-y divide-hair/60">
        {visible.map((row) => (
          <li key={row.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h4 className="text-[14px] font-semibold leading-snug text-ink">
                    {row.title}
                  </h4>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted">
                    {formatLongDate(row.createdAt, language)}
                  </span>
                </div>
                {row.body.length > 0 ? (
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-[1.5] text-ink-soft">
                    {row.body}
                  </p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() => dismissOne(row.id)}
                aria-label={t('home.announcements.dismissAria', {
                  defaultValue: 'Masquer cette annonce',
                })}
                title={t('home.announcements.dismiss', {
                  defaultValue: 'Masquer',
                })}
              >
                <XMarkIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}
