import { useMemo, type ReactNode } from 'react';
import { LIBRARY_STATUS_VALUES } from '@nodea/shared';

import {
  useNodeaStore,
  selectLibrarySubview,
} from '@/core/store/nodea-store';
import FilterChip from '@/ui/dirk/module/FilterChip';

import { useLibraryData, useLibraryFilters } from '../context';
import { STATUS_LABEL } from '../lib/constants';
import { LIBRARY_GROUP_BY_OPTIONS } from '../lib/grouping';

/**
 * Filter sidebar for the Library catalogue. Renders three sections :
 * « Grouper par » (only on the `livres` sub-view, the Extraits /
 * Notes lenses share the column for visual consistency but don't
 * re-group), « Statut » (status chips with counts including the
 * « Tous » + « ★ Favoris » pseudo-states), and « Tags » (one chip
 * per tag if any exist).
 *
 * Reads everything from contexts ; no props. The sub-view comes from
 * the global Zustand store (the privacy invariant — `/flow` URL
 * doesn't reveal the active lens).
 */
export default function SideColumn() {
  const subview = useNodeaStore(selectLibrarySubview);
  const { items } = useLibraryData();
  const {
    statusFilter,
    tagFilter,
    groupBy,
    allTags,
    setStatusFilter,
    setTagFilter,
    setGroupBy,
  } = useLibraryFilters();

  // Per-status counts shown next to the chips. Cheap to recompute
  // (six full passes over `items`) but memoised because `items` is
  // the most-frequently-changing slice ; without this, every filter
  // toggle would recount even though the underlying data is the same.
  const counts = useMemo(
    () => ({
      all: items.length,
      favorites: items.filter((it) => it.is_favorite).length,
      planned: items.filter((it) => it.status === 'planned').length,
      in_progress: items.filter((it) => it.status === 'in_progress').length,
      finished: items.filter((it) => it.status === 'finished').length,
      abandoned: items.filter((it) => it.status === 'abandoned').length,
    }),
    [items],
  );

  const showGroupBy = subview === 'livres';

  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      {showGroupBy ? (
        <section>
          <SectionLabel>Grouper par</SectionLabel>
          <div className="flex flex-wrap gap-1">
            {LIBRARY_GROUP_BY_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                active={groupBy === opt.value}
                onClick={() => setGroupBy(opt.value)}
                label={opt.label}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionLabel>Statut</SectionLabel>
        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            label="Tous"
            count={counts.all}
          />
          <FilterChip
            active={statusFilter === 'favorites'}
            onClick={() => setStatusFilter('favorites')}
            label="★ Favoris"
            count={counts.favorites}
          />
          {LIBRARY_STATUS_VALUES.map((s) => (
            <FilterChip
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              label={STATUS_LABEL[s]}
              count={counts[s]}
            />
          ))}
        </div>
      </section>

      {allTags.length > 0 ? (
        <section>
          <SectionLabel>Tags</SectionLabel>
          <div className="flex flex-wrap gap-1">
            <FilterChip
              active={tagFilter === null}
              onClick={() => setTagFilter(null)}
              label="Tous"
            />
            {allTags.map((t) => (
              <FilterChip
                key={t}
                active={tagFilter === t}
                onClick={() => setTagFilter(t)}
                label={t}
              />
            ))}
          </div>
        </section>
      ) : null}
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
