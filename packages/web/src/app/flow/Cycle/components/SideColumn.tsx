/**
 * Cycle sidebar — the « où j'en suis » ring on top (a compact, stacked
 * variant that carries the next-period read in its centre, so it replaces
 * the plain estimate card), then the 12-month averages (cycle + period
 * length). Wrapped in the shared `ModuleSidebar` shell with `SectionLabel`
 * headings, like Mood / Goals. Hidden on mobile / portrait by the shell
 * (responsive fallback handled separately).
 */
import type { ModuleClient } from '@/core/modules/use-module-client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import ModuleSidebar from '@/ui/dirk/module/ModuleSidebar';
import SectionLabel from '@/ui/dirk/module/SectionLabel';
import { averagesForYear, type CycleStats } from '../lib/cycle-model';
import CycleImport from './CycleImport';
import CycleRing from './CycleRing';

export default function SideColumn({
  stats,
  today,
  year,
  ctx,
  existingDates,
  onImported,
}: {
  stats: CycleStats;
  today: string;
  /** Selected year (null = rolling) — adds a per-year averages block. */
  year: number | null;
  ctx: ModuleClient | null;
  existingDates: ReadonlySet<string>;
  onImported: () => void;
}) {
  const { t, tn } = useI18n();
  const yearAvg = year !== null ? averagesForYear(stats.cycles, year) : null;
  /** « 27 jours » / « 1 jour » — plural-aware day count. */
  const days = (n: number) => tn('cycle.averages.days', n);

  return (
    <ModuleSidebar>
      {/* « Importer des données » — sits right under « Paramètre du module »
          (the shared trigger the shell renders first). */}
      <CycleImport ctx={ctx} existingDates={existingDates} onImported={onImported} />
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
        <SectionLabel variant="section">{t('cycle.averages.title')}</SectionLabel>
        {stats.avg.cycle !== null || stats.avg.period !== null ? (
          <div className="flex flex-col gap-1.5 text-[13px] leading-snug text-ink-soft">
            {stats.avg.cycle !== null ? (
              <p>{t('cycle.averages.cycleSentence', { values: { days: days(stats.avg.cycle) } })}</p>
            ) : null}
            {stats.avg.period !== null ? (
              <p>{t('cycle.averages.periodSentence', { values: { days: days(stats.avg.period) } })}</p>
            ) : null}
            <p className="mt-0.5 text-[11px] text-muted-soft">{t('cycle.averages.window')}</p>
          </div>
        ) : (
          <p className="text-[13px] text-muted">{t('cycle.averages.notEnough')}</p>
        )}

        {/* Per-year block — appears when a specific year is selected. */}
        {yearAvg ? (
          <div className="mt-3 border-t border-hair pt-2.5">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              {t('cycle.averages.inYear', { values: { year } })}
            </p>
            {yearAvg.cycle !== null || yearAvg.period !== null ? (
              <div className="flex flex-col gap-1.5 text-[13px] leading-snug text-ink-soft">
                {yearAvg.cycle !== null ? (
                  <p>{t('cycle.averages.yearCycleSentence', { values: { days: days(yearAvg.cycle) } })}</p>
                ) : null}
                {yearAvg.period !== null ? (
                  <p>{t('cycle.averages.yearPeriodSentence', { values: { days: days(yearAvg.period) } })}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] text-muted">{t('cycle.averages.notEnoughYear')}</p>
            )}
          </div>
        ) : null}
      </section>
    </ModuleSidebar>
  );
}
