import { ChevronUpIcon } from '@heroicons/react/24/outline';

import { useEffect, useMemo, useRef } from 'react';

import { getMonthNames } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import PageHeading from '@/ui/dirk/module/PageHeading';

import MonthSelector from '../components/MonthSelector';
import YearSelector from '../components/YearSelector';
import { useMoodData, useMoodFilters } from '../context';
import Chart from './Chart';
import EntryRow from './EntryRow';

/** Primary column for the Mood page : sticky header (H1, year
 *  picker, heatmap, section heading + month picker + frise toggle)
 *  on top, scrollable entry list below.
 *
 *  The sticky region pins flush against the topbar so the heatmap
 *  + filters always stay visible while the user scrolls through
 *  entries. The frise can be folded away to reclaim vertical
 *  space ; the toggle's chevron lives inside the sticky pane.
 *
 *  All state is read from the contexts ; no props. */
export default function PrimaryColumn() {
  const { t, language } = useI18n();
  const { entries, load } = useMoodData();
  const { year, month, chartCollapsed, searchQuery, filtered, toggleChart } =
    useMoodFilters();
  const monthNamesLong = useMemo(
    () => getMonthNames(language, 'long'),
    [language],
  );

  // Section heading describes the selected range plain-language so
  // a screen reader (and a glance) reads cleanly : « Entrées · En
  // cours », « Entrées · 2025 · mars », etc. Month is suppressed
  // for the rolling selection because the rolling window straddles
  // months by design.
  const yearLabel = year === null ? t('mood.primary.yearRolling') : String(year);
  const showMonth = year !== null && month !== null;
  const chartToggleLabel = chartCollapsed
    ? t('mood.primary.showChart')
    : t('mood.primary.hideChart');

  // Auto-collapse the frise when the user scrolls DOWN past a small
  // threshold — the heatmap is the heaviest visual element in the
  // sticky header, so folding it as the entries-list comes into view
  // reclaims the vertical real-estate the user is actually looking
  // at. No auto-restore on scroll-up : reopening stays user-driven
  // via the toggle, otherwise scrolling near the top would feel
  // jumpy. The effect short-circuits when already collapsed so the
  // listener is detached as soon as there's nothing left to do, and
  // re-attaches when the user clicks the toggle to reopen.
  const lastScrollYRef = useRef(0);
  useEffect(() => {
    if (chartCollapsed) return undefined;
    lastScrollYRef.current = window.scrollY;
    function handleScroll() {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      lastScrollYRef.current = currentY;
      if (delta > 0 && currentY > 80) {
        toggleChart();
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [chartCollapsed, toggleChart]);

  return (
    <section className="flex min-w-0 flex-col">
      {/* Sticky upper region — H1 + year picker + frise (with its
          legend) + the « Entrées · … » section header all stay
          pinned flush against the topbar so the user always sees
          where they are while scrolling the entries list.
          The `-mt-7 pt-7` pair pulls the wrapper's box up into the
          parent's `py-7` padding while keeping content at its
          original visual position ; combined with `top-13` (the
          topbar's height) this means the wrapper's natural top
          already sits at the sticky threshold, so it pins the
          instant the user starts scrolling. The `bg-bg` then
          opaque-covers any entry scrolling underneath ; `z-10`
          keeps it below the topbar (`z-20`). */}
      <div className="sticky top-13 z-10 -mt-7 bg-bg pt-7 pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          <PageHeading className="mb-0">{t('mood.title')}</PageHeading>
          <YearSelector />
        </div>

        {/* Animatable collapse — the chart stays mounted and rides a
            CSS grid-rows transition (`1fr` ↔ `0fr`) so the heatmap
            unfurls / folds smoothly without us knowing its natural
            height ahead of time. The inner `overflow-hidden` clips
            the content as the row shrinks ; the `pt-6` lives inside
            the collapsing region so the top-margin gap closes with
            the chart rather than snapping. */}
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
            chartCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
          )}
        >
          <div className="overflow-hidden pt-6">
            <Chart />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-[12px] font-semibold tracking-[0.02em] text-muted">
            {t('mood.primary.entriesHeading')} · {yearLabel}
            {showMonth ? ` · ${monthNamesLong[month]}` : ''}
          </h2>
          <div className="flex items-center gap-2">
            {year !== null ? <MonthSelector /> : null}
            {/* Frise toggle — folds / unfolds the heatmap above. The
                chevron travels with the sticky pane so it stays
                accessible while the user scrolls the entries list.
                Label + chevron pattern matches Journal's equivalent
                button so the affordance reads the same across
                modules. */}
            <button
              type="button"
              onClick={toggleChart}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-[11.5px] text-muted transition-colors hover:bg-bg-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span>{chartToggleLabel}</span>
              <ChevronUpIcon
                className={cn(
                  'h-3 w-3 transition-transform duration-200',
                  chartCollapsed && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mt-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      <div>
        {load.status === 'loading' && entries.length === 0 ? (
          <EmptyHint>{t('mood.primary.loading')}</EmptyHint>
        ) : filtered.length === 0 ? (
          <EmptyHint>
            {searchQuery.trim().length > 0
              ? t('mood.primary.emptySearch')
              : t('mood.primary.empty')}
          </EmptyHint>
        ) : (
          filtered.map((entry) => <EntryRow key={entry.id} entry={entry} />)
        )}
      </div>
    </section>
  );
}
