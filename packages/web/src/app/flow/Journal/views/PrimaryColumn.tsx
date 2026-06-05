import { ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useMemo } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import GroupBlock from '@/ui/dirk/module/GroupBlock';
import PageHeading from '@/ui/dirk/module/PageHeading';

import MobileFilters from '../components/MobileFilters';
import YearSelector from '../components/YearSelector';
import { useJournalData, useJournalFilters } from '../context';
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
    const [yyyy, mm, dd] = dayFilter.split('-').map(Number);
    const d = new Date(yyyy ?? 0, (mm ?? 1) - 1, dd ?? 1);
    return new Intl.DateTimeFormat(language, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  }, [dayFilter, language]);

  return (
    <section className="flex min-w-0 flex-col">
      {/* Sticky upper region — H1 + year picker + heatmap + the
          « Entrées · … » section heading all stay pinned flush
          against the topbar so the user always sees where they are
          while scrolling the entries list. Same `-mt-7 pt-7 top-13`
          pattern as Mood's sticky header. */}
      <div className="sticky top-13 z-10 -mt-7 bg-bg pt-7 pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          <PageHeading className="mb-0">{t('journal.title')}</PageHeading>
          <YearSelector />
        </div>

        {/* Mobile-only filters collapse — sits above the heatmap
            so the toggle stays inside the sticky header and
            remains accessible from any scroll position. Folded by
            default ; renders nothing at `lg+` because the right
            sidebar (`SideColumn`) takes over. */}
        <div className="mt-3">
          <MobileFilters />
        </div>

        {!chartCollapsed ? (
          <div className="mt-6">
            <Chart />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
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

      {/* « Il y a un an » — issue #58. Renders only on days when
          past-them left a trail ; returns null otherwise. */}
      <OnThisDayPanel />

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      <div>
        {load.status === 'loading' && entries.length === 0 ? (
          <EmptyHint>{t('journal.list.loading')}</EmptyHint>
        ) : groups.length === 0 ? (
          <EmptyHint>{t('journal.list.empty')}</EmptyHint>
        ) : (
          groups.map(([groupLabel, items]) => (
            <GroupBlock
              key={groupLabel}
              label={groupLabel}
              count={items.length}
              countNoun={t('journal.list.groupCountNoun')}
              variant={groupVariant}
              className="mb-0"
            >
              {items.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </GroupBlock>
          ))
        )}
      </div>
    </section>
  );
}
