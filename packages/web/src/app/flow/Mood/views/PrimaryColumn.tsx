import { ChevronUpIcon } from '@heroicons/react/24/outline';

import { useMemo } from 'react';

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

        {!chartCollapsed ? (
          <div className="mt-6">
            <Chart />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-[12px] font-semibold tracking-[0.02em] text-muted">
            {t('mood.primary.entriesHeading')} · {yearLabel}
            {showMonth ? ` · ${monthNamesLong[month]}` : ''}
          </h2>
          <div className="flex items-center gap-2">
            {year !== null ? <MonthSelector /> : null}
            {/* Frise toggle — folds / unfolds the heatmap above. The
                chevron travels with the sticky pane so it stays
                accessible while the user scrolls the entries list. */}
            <button
              type="button"
              onClick={toggleChart}
              aria-label={chartToggleLabel}
              title={chartToggleLabel}
              className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-bg-2 hover:text-ink"
            >
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
