/**
 * Primary content of the Cycle module : a view switcher over the three
 * surfaces from the spec (calendar / ring / stacked cycles). Owns the
 * local `view` state — it's pure UI, no reason to lift it to the page.
 */
import { useState } from 'react';
import type { CycleFlow } from '@nodea/shared';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import type { CycleStats } from '../lib/cycle-model';
import CycleCalendar from './CycleCalendar';
import CycleRing from './CycleRing';
import CycleStacked from './CycleStacked';

type CycleView = 'calendar' | 'ring' | 'stacked';
const VIEWS: readonly CycleView[] = ['calendar', 'ring', 'stacked'];

interface Props {
  stats: CycleStats;
  flowByDate: ReadonlyMap<string, CycleFlow>;
  today: string;
  selected: string | null;
  onSelectDay: (iso: string) => void;
}

export default function CycleViews({
  stats,
  flowByDate,
  today,
  selected,
  onSelectDay,
}: Props) {
  const { t, language } = useI18n();
  const [view, setView] = useState<CycleView>('calendar');

  return (
    <div>
      <div className="mb-3 inline-flex rounded-[var(--radius-control)] border border-hair p-0.5 text-[12px]">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={cn(
              'rounded-[var(--radius-input)] px-3 py-1',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              view === v ? 'bg-accent-strong text-white' : 'text-muted hover:text-ink',
            )}
          >
            {t(`cycle.view.${v}`)}
          </button>
        ))}
      </div>

      {view === 'calendar' ? (
        <CycleCalendar
          flowByDate={flowByDate}
          predictedDays={stats.predictedDays}
          today={today}
          selected={selected}
          onSelectDay={onSelectDay}
          language={language}
        />
      ) : null}

      {view === 'ring' ? (
        stats.current ? (
          <div className="py-4">
            <CycleRing
              day={stats.current.day}
              length={stats.current.length}
              periodLength={stats.cycles.at(-1)?.periodLength ?? 0}
              ovulation={stats.current.ovulation}
              next={stats.next}
              todayIso={today}
            />
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted">{t('cycle.ring.noData')}</p>
        )
      ) : null}

      {view === 'stacked' ? (
        <CycleStacked
          cycles={stats.cycles}
          language={language}
          emptyLabel={t('cycle.stacked.empty')}
          unit={(days) => t('cycle.stacked.unit', { values: { count: days } })}
          periodLabel={t('cycle.legend.period')}
          ovulationLabel={t('cycle.stacked.ovulation')}
        />
      ) : null}
    </div>
  );
}
