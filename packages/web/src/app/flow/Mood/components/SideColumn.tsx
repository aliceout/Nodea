import { useI18n } from '@/i18n/I18nProvider.jsx';
import ModuleSidebar from '@/ui/dirk/module/ModuleSidebar';
import SectionLabel from '@/ui/dirk/module/SectionLabel';

import PatternsList from './PatternsList';
import ScoreDonut from './ScoreDonut';

/**
 * Mood sidebar — score distribution donut on top, observations
 * (« Patterns ») below. Pure layout: each section's content is its own
 * component (`ScoreDonut`, `PatternsList`), both reading the *full*
 * entry list so the year / month filters don't change what's shown
 * here — the sidebar is a lifetime view by design.
 *
 * Wrapped in the shared `<ModuleSidebar>` shell, which owns the sticky
 * offset + the `lg`-AND-landscape visibility gate (no fallback on phone
 * / portrait tablet — these stats are nice-to-have, not load-bearing).
 */
export default function SideColumn() {
  const { t } = useI18n();

  return (
    <ModuleSidebar>
      <section>
        <SectionLabel variant="section">{t('mood.side.distribution')}</SectionLabel>
        <ScoreDonut />
      </section>

      <section>
        <SectionLabel variant="section">{t('mood.side.patterns')}</SectionLabel>
        <PatternsList />
      </section>
    </ModuleSidebar>
  );
}
