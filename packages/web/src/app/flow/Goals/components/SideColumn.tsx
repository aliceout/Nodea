import { useState } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import FilterChip from '@/ui/dirk/module/FilterChip';
import ManageLink from '@/ui/dirk/module/ManageLink';
import SectionLabel from '@/ui/dirk/module/SectionLabel';
import ThreadManagerModal from '@/ui/dirk/module/ThreadManagerModal';

import { useGoalsActions, useGoalsData, useGoalsFilters } from '../context';
import { CANONICAL_STATUSES } from '../lib/constants';
import type { SortBy } from '../lib/types';
import ViewModeToggle from './ViewModeToggle';

const SORT_VALUES: ReadonlyArray<SortBy> = ['date', 'updated', 'alpha'];

/**
 * Filter sidebar for the Goals catalogue. Sections : statut (chips with
 * counts), groupement (année / thème), thèmes (chips + « Gérer les
 * thèmes » manager), tri (date / récent / alpha), affichage (view-mode
 * toggle). The text search moved to the topbar (same posture as Mood /
 * Journal / Library).
 *
 * Reads all state and setters from the three Goals contexts ; no props.
 *
 * Below `lg` the desktop aside is hidden ; the same `<FiltersContent>`
 * is mounted by `<MobileFilters>` near the top of the page, folded by
 * default. Filters are functional (status + grouping + theme + sort +
 * view) so we can't drop them on mobile the way Mood's stats sidebar
 * does.
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
    statusFilter,
    groupBy,
    sortBy,
    threadFilter,
    threads,
    setStatusFilter,
    setGroupBy,
    setSortBy,
    setThreadFilter,
  } = useGoalsFilters();
  const { renameThread, deleteThread } = useGoalsActions();
  const [themesManagerOpen, setThemesManagerOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section>
        <SectionLabel variant="section">
          {t('goals.side.view', { defaultValue: 'Vue' })}
        </SectionLabel>
        <ViewModeToggle />
      </section>

      <section>
        <SectionLabel variant="section">{t('goals.side.groupBy')}</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={groupBy === 'year'}
            onClick={() => setGroupBy('year')}
            label={t('goals.side.groupByYear')}
          />
          <FilterChip
            active={groupBy === 'thread'}
            onClick={() => setGroupBy('thread')}
            label={t('goals.side.groupByThread')}
          />
        </div>
      </section>

      <section>
        <SectionLabel variant="section">{t('goals.side.statusHeading')}</SectionLabel>
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

      {/* Thèmes filter — always visible regardless of `groupBy`. The
          old conditional (`groupBy === 'thread' ? ...`) hid the
          chips whenever the user switched to « grouper par année »,
          which made the filter feel attached to the grouping
          choice. They're independent : you can group by year AND
          want to scope to a single theme. */}
      <section>
        <SectionLabel
          variant="section"
          action={
            threads.length > 0 ? (
              <ManageLink onClick={() => setThemesManagerOpen(true)}>
                {t('goals.side.themesManageCta')}
              </ManageLink>
            ) : undefined
          }
        >
          {t('goals.side.threads')}
        </SectionLabel>
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

      <section>
        <SectionLabel variant="section">{t('goals.side.sortBy')}</SectionLabel>
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

      <ThreadManagerModal
        open={themesManagerOpen}
        onClose={() => setThemesManagerOpen(false)}
        names={threads}
        onRename={renameThread}
        onDelete={deleteThread}
        i18nPrefix="goals.themesManager"
      />
    </div>
  );
}
