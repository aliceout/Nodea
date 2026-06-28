import { useI18n } from '@/i18n/I18nProvider.jsx';
import InlinePanel from '@/ui/dirk/forms/InlinePanel';
import ModuleSettingsPanel from '@/ui/dirk/module/ModuleSettingsPanel';
import ModuleSettingsTrigger from '@/ui/dirk/module/ModuleSettingsTrigger';
import { useModuleSettings } from '@/ui/dirk/module/module-settings-context';
import PageHeading from '@/ui/dirk/module/PageHeading';

import AnnouncementsCard from '../components/AnnouncementsCard';
import GoalsCard from '../components/GoalsCard';
import HeroEntry from '../components/HeroEntry';
import JournalHeatmap from '../components/JournalHeatmap';
import MoodBlock from '../components/MoodBlock';
import { useHomepageData } from '../context';

/**
 * Homepage primary column — bordered-card grid layout.
 *
 *   1. Greeting (serif, page anchor).
 *   2. Two-column grid auto-flowing four bordered home cards :
 *      HeroEntry, JournalHeatmap, MoodBlock, GoalsCard. The grid
 *      lands as two even rows on lg+ ; one column on smaller
 *      surfaces.
 *
 * Two previous blocks were retired :
 *   - `JournalFlashback` overlapped with `HeroEntry` (both pulled
 *     from the journal, the doublon was visible on a surface
 *     meant to read as a single glance).
 *   - `ReadingBlock` (Library « en cours ») was dropped per
 *     product call — the home keeps only the four « gauges » that
 *     summarise the broader habit (writing, mood, daily entry,
 *     goals).
 */
export default function PrimaryColumn() {
  const { t } = useI18n();
  const { displayName } = useHomepageData();
  const moduleSettings = useModuleSettings();

  return (
    <section className="flex min-w-0 flex-col">
      {/* Greeting + module-settings link on one row — Home has no sidebar to
          host « Paramètre du module », so it sits far right on the greeting. */}
      <div className="mb-6 flex items-center justify-between gap-4">
        {/* Smaller on mobile — the 30px desktop size dominates a phone
            screen. `mb-0` : the row's `mb-6` owns the spacing, the heading's
            default `mb-6` would double it. */}
        <PageHeading className="mb-0 text-[22px] lg:text-[30px]">
          {displayName
            ? t('home.greeting.named', { values: { name: displayName } })
            : t('home.greeting.anonymous')}
        </PageHeading>
        <ModuleSettingsTrigger className="shrink-0" label={t('home.settings')} />
      </div>

      <InlinePanel open={!!moduleSettings?.open} className="mb-6">
        <ModuleSettingsPanel onClose={() => moduleSettings?.close()} />
      </InlinePanel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Admin-pushed announcements span both columns on lg+ so
            news land before the personal cards. The card spans
            via its own `lg:col-span-2` className passthrough — when
            the announcements array is empty it returns `null`
            entirely, so no phantom grid cell shows up and the
            personal 2×2 grid stays unchanged. */}
        <AnnouncementsCard />
        <HeroEntry />
        <JournalHeatmap />
        <MoodBlock />
        <GoalsCard />
      </div>
    </section>
  );
}
