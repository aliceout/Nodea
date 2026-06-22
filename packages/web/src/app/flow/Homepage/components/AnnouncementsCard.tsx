import { useMemo } from 'react';

import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import { useHomepageData } from '../context';
import { useLocalAnnouncements } from '../lib/local-announcements';
import AnnouncementRow from './AnnouncementRow';
import HomeCard from './HomeCard';
import TipRow from './TipRow';

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
export default function AnnouncementsCard() {
  const { t } = useI18n();
  const { announcements } = useHomepageData();
  const { preferences, setPreferences } = usePreferences();
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
          <TipRow key={tip.id} tip={tip} onDismiss={dismissOne} />
        ))}
        {visibleAnnouncements.map((row) => (
          <AnnouncementRow key={row.id} announcement={row} onDismiss={dismissOne} />
        ))}
      </ul>
    </HomeCard>
  );
}
