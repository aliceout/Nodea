/**
 * Cycle sidebar — the « où j'en suis » ring on top (a compact, stacked
 * variant that carries the next-period read in its centre, so it
 * replaces the plain estimate card), then the colour legend. Wrapped in
 * the shared `ModuleSidebar` shell with `SectionLabel` headings, like
 * Mood / Goals. Hidden on mobile / portrait by the shell (responsive
 * fallback handled separately).
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';
import ModuleSidebar from '@/ui/dirk/module/ModuleSidebar';
import SectionLabel from '@/ui/dirk/module/SectionLabel';
import type { CycleStats } from '../lib/cycle-model';
import CycleRing from './CycleRing';

function LegendRow({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-3.5 w-3.5 ${swatch.includes('rounded') ? '' : 'rounded-full'} ${swatch}`}
      />
      <span>{label}</span>
    </div>
  );
}

export default function SideColumn({ stats, today }: { stats: CycleStats; today: string }) {
  const { t } = useI18n();

  return (
    <ModuleSidebar>
      <section>
        <SectionLabel variant="section">{t('cycle.side.current')}</SectionLabel>
        {stats.current ? (
          <CycleRing
            size={200}
            day={stats.current.day}
            length={stats.current.length}
            periodLength={stats.cycles.at(-1)?.periodLength ?? 0}
            ovulation={stats.current.ovulation}
            next={stats.next}
            approximate={stats.approximate}
            startIso={stats.periodStarts.at(-1) ?? today}
            todayIso={today}
          />
        ) : (
          <div className="text-[13px] text-muted">
            {t(
              stats.status === 'irregular'
                ? 'cycle.estimate.irregular'
                : 'cycle.estimate.notEnough',
            )}
          </div>
        )}
        <p className="mt-3 text-[11px] leading-snug text-muted-soft">
          {t('cycle.disclaimer')}
        </p>
      </section>

      <section>
        <SectionLabel variant="section">{t('cycle.legend.title')}</SectionLabel>
        <div className="flex flex-col gap-1.5 text-[12px] text-muted">
          <LegendRow swatch="bg-low" label={t('cycle.phase.menstrual')} />
          <LegendRow swatch="bg-phase-follicular" label={t('cycle.phase.follicular')} />
          <LegendRow swatch="bg-accent-soft" label={t('cycle.phase.fertile')} />
          <LegendRow swatch="rounded-full border-[1.5px] border-accent" label={t('cycle.phase.ovulation')} />
          <LegendRow swatch="bg-phase-luteal" label={t('cycle.phase.luteal')} />
          <LegendRow
            swatch="border border-dashed border-low-soft"
            label={t('cycle.legend.predicted')}
          />
        </div>
      </section>
    </ModuleSidebar>
  );
}
