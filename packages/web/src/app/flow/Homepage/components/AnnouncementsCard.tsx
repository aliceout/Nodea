import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

import { formatLongDate } from '@/core/i18n/date-format';
import { usePreferences } from '@/core/auth/use-preferences';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';

import { useHomepageData } from '../context';
import { useLocalAnnouncements, type LocalTipKind } from '../lib/local-announcements';
import HomeCard from './HomeCard';

/**
 * Announcements card on the Homepage — the single place where both
 * admin-pushed announcements AND client-generated onboarding / security
 * tips surface (the latter used to live in a separate sidebar tip slot;
 * folding them here means one display location and one dismissal
 * mechanism, see `lib/local-announcements.ts`).
 *
 * Lives at the top of the primary column, full-width across both grid
 * columns (via `lg:col-span-2`), so news + nudges are read first.
 *
 * **Dismissal.** Both tips and announcements append their id to
 * `preferences.dismissedAnnouncements` (an encrypted user-pref blob —
 * the server never sees what a specific user dismissed; persists across
 * devices and sessions). Non-dismissable tips (recovery-code warning)
 * carry no × and ignore that set. Once every visible row is gone the
 * card returns `null` and the grid flows back to the personal layout.
 */

// Tone-coloured title + action for client tips (server announcements
// stay on the neutral `text-ink` title). Amber for the security-upgrade
// `warning`, danger red for data-loss `danger`, sage `accent` for info.
const TIP_TITLE: Record<LocalTipKind, string> = {
  info: 'text-accent-deep',
  warning: 'text-amber-700 dark:text-amber-200',
  danger: 'text-danger',
};
const TIP_ACTION: Record<LocalTipKind, string> = {
  info: 'text-accent hover:text-accent-deep',
  warning: 'text-amber-700 hover:text-amber-800 dark:text-amber-200',
  danger: 'text-danger hover:text-danger',
};

export default function AnnouncementsCard() {
  const { t, language } = useI18n();
  const { announcements } = useHomepageData();
  const { preferences, setPreferences } = usePreferences();
  const setModule = useNodeaStore((s) => s.setModule);
  const tips = useLocalAnnouncements();

  const dismissed = useMemo(
    () => new Set(preferences.dismissedAnnouncements ?? []),
    [preferences.dismissedAnnouncements],
  );

  // Non-dismissable tips always show (their condition is the gate);
  // dismissable tips + server announcements honour the dismissed set.
  const visibleTips = useMemo(
    () => tips.filter((tip) => !tip.dismissable || !dismissed.has(tip.id)),
    [tips, dismissed],
  );
  const visibleAnnouncements = useMemo(
    () => announcements.filter((a) => !dismissed.has(a.id)),
    [announcements, dismissed],
  );

  if (visibleTips.length === 0 && visibleAnnouncements.length === 0) return null;

  function dismissOne(id: string): void {
    // Optimistic-by-default : `setPreferences` updates the Zustand slice
    // synchronously then PUTs the re-encrypted blob ; the filters above
    // re-run on the next render and the row is gone. Append-only union.
    const next = Array.from(
      new Set([...(preferences.dismissedAnnouncements ?? []), id]),
    );
    void setPreferences({ dismissedAnnouncements: next });
  }

  return (
    <HomeCard
      title={t('home.announcements.title', { defaultValue: 'Annonces' })}
      className="lg:col-span-2"
    >
      <ul className="flex flex-col divide-y divide-hair/60">
        {visibleTips.map((tip) => (
          <li key={tip.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4
                  className={cn(
                    'text-[14px] font-semibold leading-snug',
                    TIP_TITLE[tip.kind],
                  )}
                >
                  {t(tip.titleKey)}
                </h4>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-ink-soft">
                  {t(tip.bodyKey)}{' '}
                  {tip.to ? (
                    <Link
                      to={tip.to}
                      className={cn(
                        'font-medium transition-colors hover:underline',
                        TIP_ACTION[tip.kind],
                      )}
                    >
                      {t(tip.actionKey)} →
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (tip.module) setModule(tip.module);
                      }}
                      className={cn(
                        'cursor-pointer font-medium transition-colors hover:underline',
                        TIP_ACTION[tip.kind],
                      )}
                    >
                      {t(tip.actionKey)} →
                    </button>
                  )}
                </p>
              </div>
              {tip.dismissable ? (
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => dismissOne(tip.id)}
                  aria-label={t('home.announcements.dismissAria', {
                    defaultValue: 'Masquer cette annonce',
                  })}
                  title={t('home.announcements.dismiss', { defaultValue: 'Masquer' })}
                >
                  <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </li>
        ))}

        {visibleAnnouncements.map((row) => (
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
                title={t('home.announcements.dismiss', { defaultValue: 'Masquer' })}
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
