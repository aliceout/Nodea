/**
 * Cycle sidebar — the next-period estimate + colour legend, wrapped in
 * the shared `ModuleSidebar` shell with `SectionLabel` headings, exactly
 * like Mood / Goals / Journal. Hidden on mobile / portrait by the shell
 * (the ring centre carries the same « next period » read there).
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';
import ModuleSidebar from '@/ui/dirk/module/ModuleSidebar';
import SectionLabel from '@/ui/dirk/module/SectionLabel';
import type { CycleStats } from '../lib/cycle-model';

function LegendRow({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-3.5 w-3.5 rounded-full ${swatch}`} />
      <span>{label}</span>
    </div>
  );
}

export default function SideColumn({ stats }: { stats: CycleStats }) {
  const { t, language } = useI18n();
  const nextLabel =
    stats.next &&
    new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long' }).format(
      new Date(`${stats.next.date}T12:00:00`),
    );

  return (
    <ModuleSidebar>
      <section>
        <SectionLabel variant="section">{t('cycle.estimate.title')}</SectionLabel>
        {stats.status === 'ok' && stats.next ? (
          <>
            <div className="text-lg font-semibold capitalize text-ink">{nextLabel}</div>
            <div className="text-[12px] text-muted">
              {t('cycle.estimate.inDays', { values: { count: stats.next.daysUntil } })} ·{' '}
              {t('cycle.estimate.avg', { values: { days: stats.averageCycle ?? 0 } })}
            </div>
          </>
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
          <LegendRow swatch="bg-low" label={t('cycle.legend.period')} />
          <LegendRow
            swatch="border border-dashed border-low-soft"
            label={t('cycle.legend.predicted')}
          />
          <LegendRow swatch="bg-accent-soft" label={t('cycle.legend.today')} />
        </div>
      </section>
    </ModuleSidebar>
  );
}
