/**
 * Cycle graph header — the three switchable views (calendar / ring /
 * stacked) in the same sticky-collapsible frame as the Mood / Journal
 * frise : pinned under the topbar (`sticky top-13`), foldable via
 * `CollapseToggle`, and auto-folded when the user scrolls down (the
 * graph is the heaviest element, so it yields to the entries list).
 * A fixed min-height keeps the frame stable across view switches so the
 * list below doesn't jump. `formOpen` folds the graph + hides the
 * toggle while the day composer is open, exactly like Mood.
 */
import { useEffect, useRef, useState } from 'react';
import type { CycleFlow, CycleHormoneProfile } from '@nodea/shared';
import type { HormoneProfile } from '../lib/hormones';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import CollapseToggle from '@/ui/dirk/module/CollapseToggle';
import { useModuleSettings } from '@/ui/dirk/module/module-settings-context';
import PageHeading from '@/ui/dirk/module/PageHeading';
import Tabs from '@/ui/dirk/Tabs';
import type { CycleStats } from '../lib/cycle-model';
import CycleCalendar from './CycleCalendar';
import CycleHormones from './CycleHormones';
import CycleMonthSelector from './CycleMonthSelector';
import CycleStacked from './CycleStacked';
import CycleYearSelector from './CycleYearSelector';

type CycleView = 'calendar' | 'stacked' | 'hormones';

interface Props {
  stats: CycleStats;
  flowByDate: ReadonlyMap<string, CycleFlow>;
  today: string;
  selected: string | null;
  onSelectDay: (iso: string) => void;
  /** Composer open : fold the graph + hide the toggle (Mood parity). */
  formOpen: boolean;
  year: number | null;
  month: number | null;
  availableYears: readonly number[];
  onYearChange: (year: number | null) => void;
  onMonthChange: (month: number | null) => void;
  /** Hormone-curve reference profile ; « off » hides the tab. */
  hormoneProfile: CycleHormoneProfile;
}

export default function CycleViews({
  stats,
  flowByDate,
  today,
  selected,
  onSelectDay,
  formOpen,
  year,
  month,
  availableYears,
  onYearChange,
  onMonthChange,
  hormoneProfile,
}: Props) {
  const { t, language } = useI18n();
  const showHormones = hormoneProfile !== 'off';
  const settings = useModuleSettings();
  const settingsOpen = !!settings?.open;
  const [view, setView] = useState<CycleView>('calendar');
  const [collapsed, setCollapsed] = useState(false);

  const views: CycleView[] = showHormones
    ? ['calendar', 'stacked', 'hormones']
    : ['calendar', 'stacked'];

  // Fall back to the calendar if the hormone tab is turned off while open.
  useEffect(() => {
    if (!showHormones && view === 'hormones') setView('calendar');
  }, [showHormones, view]);

  // Auto-collapse on scroll-DOWN past a small threshold — same posture
  // as the Mood / Journal frise. Detach before toggling so a fast scroll
  // folds exactly once ; no auto-restore on scroll-up (stays user-driven).
  const lastScrollYRef = useRef(0);
  useEffect(() => {
    if (collapsed || formOpen || settingsOpen) return undefined;
    lastScrollYRef.current = window.scrollY;
    function handleScroll() {
      const y = window.scrollY;
      const delta = y - lastScrollYRef.current;
      lastScrollYRef.current = y;
      if (delta > 0 && y > 80) {
        window.removeEventListener('scroll', handleScroll);
        setCollapsed(true);
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [collapsed, formOpen, settingsOpen]);

  // Fold the graph while the composer OR the settings panel is open.
  const folded = collapsed || formOpen || settingsOpen;

  return (
    <div className="sticky top-13 z-10 -mt-7 bg-bg pt-7 pb-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <PageHeading className="mb-0 hidden lg:block">{t('cycle.title')}</PageHeading>
        <CycleYearSelector
          year={year}
          availableYears={availableYears}
          onChange={onYearChange}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={views.map((v) => ({ id: v, label: t(`cycle.view.${v}`) }))}
          value={view}
          onChange={setView}
        />
        {formOpen || settingsOpen ? null : (
          <CollapseToggle
            open={!collapsed}
            onToggle={() => setCollapsed((c) => !c)}
            label={collapsed ? t('cycle.showChart') : t('cycle.hideChart')}
          />
        )}
      </div>

      {/* Animatable collapse : the graph rides a grid-rows 1fr↔0fr
          transition (same as the heatmap) ; the inner min-height keeps
          the frame stable across view switches. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
          folded ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        )}
      >
        <div className="overflow-hidden pt-4">
          {/* Fixed 300px, no scroll — every view is sized to fit, so the
              frame height stays stable across view switches. */}
          <div className="h-[300px] overflow-hidden">
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

            {view === 'hormones' ? (
              <CycleHormones
                length={stats.current?.length ?? 28}
                day={stats.current?.day ?? null}
                profile={hormoneProfile as HormoneProfile}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Month strip — only when a specific year is selected (the
          rolling window straddles months). Filters the entries list. */}
      {year !== null ? (
        <div className="mt-3">
          <CycleMonthSelector month={month} onChange={onMonthChange} />
        </div>
      ) : null}
    </div>
  );
}
