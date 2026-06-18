import { ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useMemo } from 'react';

import { intlLocale, parseLocalDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import PageHeading from '@/ui/dirk/module/PageHeading';
import GroupedVirtualList from '@/ui/atoms/layout/GroupedVirtualList';

import JournalForm from '../components/JournalForm';
import MobileFilters from '../components/MobileFilters';
import YearSelector from '../components/YearSelector';
import { useJournalActions, useJournalData, useJournalFilters } from '../context';
import Chart from './Chart';
import EntryRow from './EntryRow';
import OnThisDayPanel from './OnThisDayPanel';

/**
 * Main rendering surface for Journal — sticky H1 + year picker +
 * writing-density heatmap (#56) on top, then « Il y a un an » +
 * the grouped entries list below.
 *
 * Mirrors Mood's `PrimaryColumn` : the heatmap can be folded away
 * via the chevron toggle (`chartCollapsed`), and the year tab
 * strip narrows both the list and the heatmap to a single calendar
 * year (or « En cours » for the rolling-52-weeks default).
 *
 * Reads everything from the data + filters contexts ; no props.
 */
export default function PrimaryColumn() {
  const { t, language } = useI18n();
  const { entries, load } = useJournalData();
  const {
    groupBy,
    groups,
    year,
    chartCollapsed,
    dayFilter,
    toggleChart,
    setDayFilter,
  } = useJournalFilters();
  const { formOpen, editingEntry, closeForm } = useJournalActions();
  const groupVariant = groupBy === 'month' ? 'eyebrow' : 'subtitle';

  const yearLabel =
    year === null ? t('journal.primary.yearRolling') : String(year);
  const chartToggleLabel = chartCollapsed
    ? t('journal.primary.showChart')
    : t('journal.primary.hideChart');

  // « Lun. 4 juin 2026 » format for the dismissible day-filter chip.
  // See Mood's PrimaryColumn for the rationale on the local-zone
  // date parsing — same shape so the two modules read alike.
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

  // Defined once, rendered in two places : the mobile filters row
  // (via MobileFilters' `trailing`) and the desktop entries-heading
  // row. Only one is visible per breakpoint (the other's container is
  // hidden), so there's no duplicate on screen.
  const chartToggleButton = (
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
  );

  return (
    <section className="flex min-w-0 flex-col">
      {/* Sticky upper region — H1 + year picker + heatmap + the
          « Entrées · … » section heading all stay pinned flush
          against the topbar so the user always sees where they are
          while scrolling the entries list. Same `-mt-7 pt-7 top-13`
          pattern as Mood's sticky header. */}
      <div className="sticky top-13 z-10 -mt-7 bg-bg pt-7 pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          {/* lg+ only — on mobile the topbar carries the module name. */}
          <PageHeading className="mb-0 hidden lg:block">{t('journal.title')}</PageHeading>
          <YearSelector />
        </div>

        {/* Mobile-only filters collapse — sits above the heatmap so
            the toggle stays inside the sticky header, accessible from
            any scroll position. The « carte d'écriture » toggle shares
            this row on mobile (passed as `trailing`). Renders nothing
            at `lg+`, where the sidebar (`SideColumn`) + the desktop
            heading row below take over. */}
        <div className="mt-3">
          <MobileFilters trailing={chartToggleButton} />
        </div>

        {!chartCollapsed ? (
          <div className="mt-6">
            <Chart />
          </div>
        ) : null}

        {/* Desktop entries heading + « carte d'écriture » toggle.
            Hidden on mobile : there the toggle rides the filters row
            above and the heading is redundant with the topbar name.
            The day-filter chip lives here (desktop-only for now). */}
        <div className="mt-3 hidden flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:flex">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[12px] font-semibold tracking-[0.02em] text-muted">
              {t('journal.primary.entriesHeading')} · {yearLabel}
            </h2>
            {/* Active day-filter chip — explicit clear affordance
                for the heatmap-driven date narrowing. Same shape as
                Mood's so the two modules read alike. */}
            {dayFilter ? (
              <button
                type="button"
                onClick={() => setDayFilter(null)}
                title={t('journal.primary.clearDayFilterTitle')}
                aria-label={t('journal.primary.clearDayFilterAria')}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-hair bg-bg-2 px-2 py-0.5 text-[11px] text-ink-soft transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span>{dayFilterLabel}</span>
                <XMarkIcon className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {chartToggleButton}
        </div>
      </div>

      {/* Inline composer — rendered above the « Il y a un an » block
          and the entries list. Same posture as Mood / Goals : a
          bordered card that takes over the writing flow without
          stealing the surrounding chrome. Keyed on the edited entry
          id so switching from edit-A to edit-B remounts the form
          with the right initial values. */}
      {formOpen ? (
        <JournalForm
          key={editingEntry?.id ?? 'create'}
          {...(editingEntry ? { initial: editingEntry } : {})}
          onClose={closeForm}
        />
      ) : null}

      {/* « Il y a un an » — issue #58. Renders only on days when
          past-them left a trail ; returns null otherwise. */}
      <OnThisDayPanel />

      {load.status === 'error' ? (
        <InlineAlert className="mb-4">{load.message}</InlineAlert>
      ) : null}

      <div>
        {load.status === 'loading' && entries.length === 0 ? (
          <EmptyHint>{t('journal.list.loading')}</EmptyHint>
        ) : groups.length === 0 ? (
          <EmptyHint>{t('journal.list.empty')}</EmptyHint>
        ) : (
          // Single flattened virtualized list across all groups
          // (audit 2026-06 passe 2) : the old per-group
          // VirtualWindowList never crossed its threshold inside any
          // one thread, so nothing was virtualized at scale.
          <GroupedVirtualList
            groups={groups}
            getItemKey={(e) => e.id}
            renderItem={(entry) => <EntryRow entry={entry} />}
            countNoun={t('journal.list.groupCountNoun')}
            variant={groupVariant}
            estimateRowHeight={110}
          />
        )}
      </div>
    </section>
  );
}
