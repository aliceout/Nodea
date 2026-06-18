import { XMarkIcon } from '@heroicons/react/24/outline';

import { useEffect, useMemo, useRef } from 'react';

import { getMonthNames, intlLocale, parseLocalDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import CollapseToggle from '@/ui/dirk/module/CollapseToggle';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import PageHeading from '@/ui/dirk/module/PageHeading';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import VirtualWindowList from '@/ui/atoms/layout/VirtualWindowList';

import MonthSelector from '../components/MonthSelector';
import MoodForm from '../components/MoodForm';
import YearSelector from '../components/YearSelector';
import { useMoodActions, useMoodData, useMoodFilters } from '../context';
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
  const {
    year,
    month,
    chartCollapsed,
    searchQuery,
    dayFilter,
    filtered,
    toggleChart,
    setDayFilter,
  } = useMoodFilters();
  const { formOpen, editingEntry, closeForm } = useMoodActions();
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

  // « Lun. 4 juin 2026 » format for the dismissible day-filter chip.
  // Parses the ISO bits directly to a local-zone date so the label
  // never drifts by a day depending on the user's tz (constructing
  // `new Date('2026-06-04')` treats it as UTC midnight).
  const dayFilterLabel = useMemo(() => {
    if (!dayFilter) return '';
    const d = parseLocalDate(dayFilter);
    return new Intl.DateTimeFormat(intlLocale(language), {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  }, [dayFilter, language]);

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
          {/* lg+ only — on mobile the topbar carries the module name. */}
          <PageHeading className="mb-0 hidden lg:block">{t('mood.title')}</PageHeading>
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
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[12px] font-semibold tracking-[0.02em] text-muted">
              {t('mood.primary.entriesHeading')} · {yearLabel}
              {showMonth ? ` · ${monthNamesLong[month]}` : ''}
            </h2>
            {/* Active day-filter chip — surfaces the date the user
                picked on the heatmap and offers an explicit clear
                via the cross. Without this, the only way to undo
                the filter is to re-click the same cell (not
                discoverable). */}
            {dayFilter ? (
              <button
                type="button"
                onClick={() => setDayFilter(null)}
                title={t('mood.primary.clearDayFilterTitle')}
                aria-label={t('mood.primary.clearDayFilterAria')}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-hair bg-bg-2 px-2 py-0.5 text-[11px] text-ink-soft transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span>{dayFilterLabel}</span>
                <XMarkIcon className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {year !== null ? <MonthSelector /> : null}
            {/* Frise toggle — folds / unfolds the heatmap above. The
                chevron travels with the sticky pane so it stays
                accessible while the user scrolls the entries list. */}
            <CollapseToggle
              open={!chartCollapsed}
              onToggle={toggleChart}
              label={chartToggleLabel}
            />
          </div>
        </div>
      </div>

      {/* Inline form — sits above the entries list when the topbar
          « + Nouvelle entrée » button or an edit affordance opens
          it. The form's own Cancel / Save buttons toggle
          `formOpen` back off via `closeForm`. Keyed on
          `editingEntry?.id` so switching from « edit row A » to
          « edit row B » without closing in between remounts the
          form with the right initial values rather than
          re-applying defaults to a still-mounted draft. */}
      {formOpen ? (
        <div className="mt-4">
          <MoodForm
            key={editingEntry?.id ?? 'create'}
            {...(editingEntry ? { initial: editingEntry } : {})}
            onClose={closeForm}
          />
        </div>
      ) : null}

      {load.status === 'error' ? (
        <InlineAlert className="mt-4">{load.message}</InlineAlert>
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
          <VirtualWindowList
            items={filtered}
            estimateRowHeight={75}
            getKey={(e) => e.id}
            renderItem={(e) => <EntryRow entry={e} />}
          />
        )}
      </div>
    </section>
  );
}
