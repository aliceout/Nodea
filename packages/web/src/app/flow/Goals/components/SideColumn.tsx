import type { ReactNode } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import FilterChip from '@/ui/dirk/module/FilterChip';

import { useGoalsActions, useGoalsData, useGoalsFilters } from '../context';
import { CANONICAL_STATUSES } from '../lib/constants';
import type { SortBy } from '../lib/types';

const SORT_VALUES: ReadonlyArray<SortBy> = ['date', 'updated', 'alpha'];

/**
 * Filter sidebar for the Goals catalogue. Sections : recherche
 * texte, statut (chips with counts), groupement (thread / année),
 * tri (date / récent / alpha), affichage (toggle masquer terminés),
 * actions (bouton report d'année).
 *
 * Reads all state and setters from the three Goals contexts ; no
 * props.
 *
 * Below `lg` the desktop aside is hidden ; the same
 * `<FiltersContent>` is mounted by `<MobileFilters>` near the top
 * of the page, folded by default. Filters are functional
 * (search + status + grouping + sort + hide-done + carry-over) so
 * we can't drop them on mobile the way Mood's stats sidebar does.
 */
export default function SideColumn() {
  return (
    <aside className="sticky top-20 hidden min-w-0 flex-col gap-6 self-start lg:flex">
      <FiltersContent />
    </aside>
  );
}

/**
 * Filter sections without the `<aside>` wrapper. Re-used by the
 * mobile collapse (`MobileFilters`) and the desktop sidebar
 * (`SideColumn`). One instance is always hidden via the wrapping
 * `hidden lg:flex` / `lg:hidden` so the duplicated state +
 * memoised counts don't fire on both surfaces in practice.
 */
export function FiltersContent() {
  const { t } = useI18n();
  const { entries, stats } = useGoalsData();
  const {
    search,
    statusFilter,
    groupBy,
    sortBy,
    hideDone,
    threadFilter,
    threads,
    setSearch,
    setStatusFilter,
    setGroupBy,
    setSortBy,
    setHideDone,
    setThreadFilter,
  } = useGoalsFilters();
  const { openCarryOver } = useGoalsActions();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section>
        <SectionLabel>{t('goals.side.search')}</SectionLabel>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('goals.side.searchPlaceholder')}
          aria-label={t('goals.side.searchAria')}
        />
      </section>

      <section>
        <SectionLabel>{t('goals.side.statusHeading')}</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={statusFilter === null}
            onClick={() => setStatusFilter(null)}
            label={t('goals.side.all')}
            count={stats.total}
          />
          {CANONICAL_STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              label={t(`goals.status.lower.${s}`)}
              count={s === 'open' ? stats.open : s === 'wip' ? stats.wip : stats.done}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>{t('goals.side.groupBy')}</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={groupBy === 'thread'}
            onClick={() => setGroupBy('thread')}
            label={t('goals.side.groupByThread')}
          />
          <FilterChip
            active={groupBy === 'year'}
            onClick={() => setGroupBy('year')}
            label={t('goals.side.groupByYear')}
          />
        </div>
      </section>

      {groupBy === 'thread' ? (
        <section>
          <SectionLabel>{t('goals.side.threads')}</SectionLabel>
          {threads.length === 0 ? (
            <p className="text-[12px] italic text-muted">
              {t('goals.side.threadsEmpty')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              <FilterChip
                active={threadFilter === null}
                onClick={() => setThreadFilter(null)}
                label={t('goals.side.threadsAll')}
                count={entries.length}
              />
              {threads.map((thread) => (
                <FilterChip
                  key={thread}
                  active={threadFilter === thread}
                  onClick={() => setThreadFilter(thread)}
                  label={thread}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section>
        <SectionLabel>{t('goals.side.sortBy')}</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {SORT_VALUES.map((s) => (
            <FilterChip
              key={s}
              active={sortBy === s}
              onClick={() => setSortBy(s)}
              label={t(`goals.sort.${s}`)}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>{t('goals.side.display')}</SectionLabel>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-soft">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded-sm border border-hair accent-accent"
          />
          <span>{t('goals.side.hideDone', { values: { count: stats.done } })}</span>
        </label>
      </section>

      <section>
        <SectionLabel>{t('goals.side.actions')}</SectionLabel>
        <Button
          variant="neutral"
          size="sm"
          onClick={openCarryOver}
          className="w-full justify-center"
        >
          <ArrowPathIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('goals.side.carryOverCta')}
        </Button>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">
      {children}
    </div>
  );
}
