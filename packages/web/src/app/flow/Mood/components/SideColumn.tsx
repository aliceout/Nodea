import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';

import PatternsList from './PatternsList';
import ScoreDonut from './ScoreDonut';

/**
 * Mood sidebar — score distribution donut on top, observations
 * (« Patterns ») below. Pure layout: each section's content is its own
 * component (`ScoreDonut`, `PatternsList`), both reading the *full*
 * entry list so the year / month filters don't change what's shown
 * here — the sidebar is a lifetime view by design.
 *
 * Below `lg` the whole column is hidden : the stats are nice-to-have,
 * not load-bearing, and stacking ~200 px of lifetime aggregates under
 * the entries list on a phone is more noise than insight.
 */
export default function SideColumn() {
  const { t } = useI18n();

  return (
    <aside className="sticky top-20 hidden min-w-0 flex-col gap-6 self-start lg:flex">
      <section>
        <SectionLabel>{t('mood.side.distribution')}</SectionLabel>
        <ScoreDonut />
      </section>

      <section>
        <SectionLabel>{t('mood.side.patterns')}</SectionLabel>
        <PatternsList />
      </section>
    </aside>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">
      {children}
    </div>
  );
}
