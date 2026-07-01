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
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
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
  /** Set the year + month together (calendar arrows) so the selectors track. */
  onAnchorChange: (year: number, month: number) => void;
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
  onAnchorChange,
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

  // Anchor month for the graphs, from the header selectors : the picked month
  // if any, else the current month (rolling / current year), else December of a
  // selected past year. Calendar shows the anchor month + the two before it ;
  // stacked shows the anchor month's cycle + the four before it.
  const [cY, cM] = today.split('-').map(Number);
  const curKey = cY! * 12 + (cM! - 1);
  // Bounds : one month past today (far enough for the next-period prediction,
  // no empty future) ; back to January of the earliest year that has data.
  const maxKey = curKey + 1;
  const minKey = availableYears.length ? Math.min(...availableYears) * 12 : 0;
  const anchorY = year ?? cY!;
  const anchorM = month ?? (year !== null && year !== cY! ? 11 : cM! - 1);
  const anchorKey = anchorY * 12 + anchorM;
  const canGoForward = anchorKey < maxKey;
  const canGoBack = anchorKey > minKey;
  // The calendar arrows drive the year + month selectors (one shared setter),
  // so navigating keeps the header in sync.
  const shiftMonth = (delta: number) => {
    const k = Math.max(minKey, Math.min(anchorKey + delta, maxKey));
    onAnchorChange(Math.floor(k / 12), k % 12);
  };

  return (
    <div className="sticky top-13 z-10 -mt-7 bg-bg pt-7 pb-3">
      {/* `items-start` top-aligns the year selector with the sidebar's
          first heading (« Paramètre du module ») across the two columns,
          instead of `items-center` centering it against the tall H1 and
          pushing it below the sidebar's top (Mood parity). */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <PageHeading className="mb-0 hidden lg:block">{t('cycle.title')}</PageHeading>
        <CycleYearSelector
          year={year}
          availableYears={availableYears}
          onChange={onYearChange}
        />
      </div>

      <div className="mt-3">
        <Tabs
          tabs={views.map((v) => ({ id: v, label: t(`cycle.view.${v}`) }))}
          value={view}
          onChange={setView}
        />
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
            {/* Calendar top-aligned (`items-start`) so the month name keeps a
                fixed position across 5- vs 6-week months ; the arrows are
                `self-center` to sit at the vertical middle regardless. */}
            {view === 'calendar' ? (
              <div className="flex h-full items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  disabled={!canGoBack}
                  aria-label={t('cycle.calendar.prevMonth')}
                  className="flex h-8 w-8 shrink-0 self-center items-center justify-center rounded-full text-muted transition-colors hover:bg-bg-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-muted"
                >
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <CycleCalendar
                    flowByDate={flowByDate}
                    phaseByDate={stats.phaseByDate}
                    predictedDays={stats.predictedDays}
                    today={today}
                    anchorY={anchorY}
                    anchorM={anchorM}
                    selected={selected}
                    onSelectDay={onSelectDay}
                    language={language}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  disabled={!canGoForward}
                  aria-label={t('cycle.calendar.nextMonth')}
                  className="flex h-8 w-8 shrink-0 self-center items-center justify-center rounded-full text-muted transition-colors hover:bg-bg-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-muted"
                >
                  <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            {view === 'stacked' ? (
              <CycleStacked
                cycles={stats.cycles}
                anchorY={anchorY}
                anchorM={anchorM}
                language={language}
                emptyLabel={t('cycle.stacked.empty')}
                unit={(days) => t('cycle.stacked.unit', { values: { count: days } })}
                periodLabel={t('cycle.phase.menstrual')}
                ovulationLabel={t('cycle.phase.ovulation')}
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

      {/* Below-graph row (Mood parity) : the month strip on the left (only
          when a specific year is selected — the rolling window straddles
          months) and the fold toggle on the right, hidden while an inline
          panel is open. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          {year !== null ? (
            <CycleMonthSelector month={month} onChange={onMonthChange} />
          ) : null}
        </div>
        {formOpen || settingsOpen ? null : (
          <CollapseToggle
            open={!collapsed}
            onToggle={() => setCollapsed((c) => !c)}
            label={collapsed ? t('cycle.showChart') : t('cycle.hideChart')}
          />
        )}
      </div>
    </div>
  );
}
