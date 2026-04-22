import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import Subheader from '@/ui/layout/headers/Subheader';
import SectionHeader from '@/ui/atoms/typography/SectionHeader.jsx';
import { MODULES, type ModuleDef } from '@/app/config/modules_list';
import {
  useNodeaStore,
  selectUser,
  selectModules,
} from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import HeroSection from './components/HeroSection';
import ModuleCard from './components/ModuleCard';
import AvailableModules from './components/AvailableModules';
import AnnouncementSpotlight from './components/AnnouncementSpotlight';
import MoodOverview from './components/MoodOverview';

/** Preferred display name: the part before `@` in the email. */
function preferredName(email: string | undefined): string {
  if (!email) return '';
  const [local] = email.split('@');
  return local ?? '';
}

/**
 * Homepage (TSX).
 *
 * Restored composition:
 *   - HeroSection (greeting)
 *   - AnnouncementSpotlight — picks up `GET /announcements` when R10
 *     lands; silent 404 until then (no UI tombstone).
 *   - MoodOverview — 20-entry sparkline + rolling average via
 *     `useMoodTrend` (Mood module, R3).
 *   - Quick-action cards for enabled modules.
 *   - AvailableModules — suggestion strip for the not-yet-active ones.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const user = useNodeaStore(selectUser);
  const modulesRuntime = useNodeaStore(selectModules);
  const { t, language } = useI18n();

  const name = useMemo(() => preferredName(user?.email), [user?.email]);

  const { greeting, formattedDate } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let greetingKey = 'home.greeting.morning';
    if (hour >= 18) greetingKey = 'home.greeting.evening';
    else if (hour >= 12) greetingKey = 'home.greeting.afternoon';

    const localeTag = language === 'en' ? 'en-US' : 'fr-FR';
    const formatter = new Intl.DateTimeFormat(localeTag, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    return {
      greeting: t(greetingKey),
      formattedDate: formatter.format(now),
    };
  }, [t, language]);

  const modules: Array<ModuleDef & { enabled: boolean }> = useMemo(() => {
    return MODULES.filter((m) => m.id !== 'home' && m.display !== false).map((m) => ({
      ...m,
      enabled: !m.to_toggle || Boolean(modulesRuntime[m.id]?.enabled),
    }));
  }, [modulesRuntime]);

  const enabledModules = useMemo(() => modules.filter((m) => m.enabled), [modules]);
  const disabledModules = useMemo(() => modules.filter((m) => !m.enabled), [modules]);
  const moodModule = useMemo(
    () => enabledModules.find((m) => m.id === 'mood'),
    [enabledModules],
  );

  const handleNavigate = useCallback(
    (moduleId: string) => {
      navigate(`/flow/${moduleId}`);
    },
    [navigate],
  );

  const quickActionsLabel = t('home.sections.actions.title', {
    defaultValue: 'Actions rapides',
  });
  const activeBadgeLabel = t('settings.modules.badges.active', {
    defaultValue: 'Module actif',
  });

  return (
    <div className="flex min-h-full flex-col">
      <Subheader />

      <div className="flex-1 pt-4">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
            <div className="flex-1">
              <HeroSection greeting={greeting} name={name} formattedDate={formattedDate} />
            </div>
            <AnnouncementSpotlight />
          </div>

          {moodModule ? <MoodOverview module={moodModule} /> : null}

          {enabledModules.length > 0 ? (
            <section className="space-y-4">
              <SectionHeader title={quickActionsLabel} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {enabledModules.map((module) => (
                  <ModuleCard
                    key={module.id}
                    module={module}
                    onNavigate={handleNavigate}
                    badgeLabel={activeBadgeLabel}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <AvailableModules modules={disabledModules} onNavigate={handleNavigate} />
        </div>
      </div>
    </div>
  );
}
