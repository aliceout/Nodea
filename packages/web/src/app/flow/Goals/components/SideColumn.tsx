import type { ReactNode } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import FilterChip from '@/ui/dirk/FilterChip';

import { useGoalsActions, useGoalsData, useGoalsFilters } from '../context';
import {
  CANONICAL_STATUSES,
  SORT_LABEL,
  STATUS_LABEL,
} from '../lib/constants';
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
 */
export default function SideColumn() {
  const { stats } = useGoalsData();
  const {
    search,
    statusFilter,
    groupBy,
    sortBy,
    hideDone,
    setSearch,
    setStatusFilter,
    setGroupBy,
    setSortBy,
    setHideDone,
  } = useGoalsFilters();
  const { openCarryOver } = useGoalsActions();

  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      <section>
        <SectionLabel>Recherche</SectionLabel>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Titre, note ou fil…"
          aria-label="Rechercher dans les objectifs"
        />
      </section>

      <section>
        <SectionLabel>Statut</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={statusFilter === null}
            onClick={() => setStatusFilter(null)}
            label="Tous"
            count={stats.total}
          />
          {CANONICAL_STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              label={STATUS_LABEL[s]}
              count={s === 'open' ? stats.open : s === 'wip' ? stats.wip : stats.done}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Grouper par</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={groupBy === 'thread'}
            onClick={() => setGroupBy('thread')}
            label="Thread"
          />
          <FilterChip
            active={groupBy === 'year'}
            onClick={() => setGroupBy('year')}
            label="Année"
          />
        </div>
      </section>

      <section>
        <SectionLabel>Trier par</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {SORT_VALUES.map((s) => (
            <FilterChip
              key={s}
              active={sortBy === s}
              onClick={() => setSortBy(s)}
              label={SORT_LABEL[s]}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Affichage</SectionLabel>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-soft">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded-sm border border-hair accent-accent"
          />
          <span>Masquer les terminés ({stats.done})</span>
        </label>
      </section>

      <section>
        <SectionLabel>Actions</SectionLabel>
        <Button
          variant="neutral"
          size="sm"
          onClick={openCarryOver}
          className="w-full justify-center"
        >
          <ArrowPathIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Reporter sur l'année prochaine
        </Button>
      </section>
    </aside>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">
      {children}
    </div>
  );
}
