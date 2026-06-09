import EmptyHint from '@/ui/dirk/module/EmptyHint';
import GroupBlock from '@/ui/dirk/module/GroupBlock';
import PageHeading from '@/ui/dirk/module/PageHeading';
import VirtualWindowList from '@/ui/atoms/layout/VirtualWindowList';

import { useLibraryData, useLibraryFilters } from '../context';
import { CELL_FILTER_LABEL } from '../lib/cell-filter';
import BookGrid from './BookGrid';
import BookTable from './BookTable';
import BookWall from './BookWall';
import ItemRow from './ItemRow';

/**
 * Catalogue rendering surface for the `livres` sub-view. Picks the
 * concrete view (`BookList` (inline) / `BookGrid` / `BookWall` /
 * `BookTable`) based on the active `viewMode`, renders the load /
 * empty / error states, and shows the « cell filter » banner with
 * a dismiss button when one is active.
 *
 * No props — everything comes from the data + filters contexts.
 */
export default function PrimaryColumn() {
  const { items, load } = useLibraryData();
  const { viewMode, cellFilter, filteredItems, groups, setCellFilter } =
    useLibraryFilters();

  const total = items.length;
  const filteredCount = filteredItems.length;
  const isListMode = viewMode === 'list-plain' || viewMode === 'list-cover';

  // Flat list for the gallery views — they ignore the grouping
  // (a wall of covers fragmented into N section headers would break
  // the visual rhythm). The status is still surfaced as a small
  // pill on each card so the user can tell « in progress » apart
  // from « finished » at a glance.
  const flatItems = filteredItems;

  return (
    <section className="flex min-w-0 flex-col">
      <PageHeading>Library</PageHeading>

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      {cellFilter ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
          <span className="text-muted">Filtre :</span>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-accent bg-accent-soft/40 px-2 py-0.5 text-accent-deep">
            <span>
              <span className="font-semibold">
                {CELL_FILTER_LABEL[cellFilter.field]}
              </span>{' '}
              · {cellFilter.value}
            </span>
            <button
              type="button"
              onClick={() => setCellFilter(null)}
              aria-label="Retirer le filtre"
              className="cursor-pointer text-accent-deep transition-colors hover:text-ink"
            >
              ✕
            </button>
          </span>
        </div>
      ) : null}

      <div>
        {load.status === 'loading' && total === 0 ? (
          <EmptyHint>Chargement de la bibliothèque…</EmptyHint>
        ) : filteredCount === 0 ? (
          <EmptyHint>
            {total === 0
              ? 'Aucun livre — ajoute le premier avec « + Nouveau livre ».'
              : 'Aucun livre pour cette sélection.'}
          </EmptyHint>
        ) : isListMode ? (
          groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <GroupBlock
                key={g.key}
                label={g.label}
                count={g.items.length}
                countNoun="livre"
                variant="subtitle"
                listTag="div"
              >
                <VirtualWindowList
                  items={g.items}
                  estimateRowHeight={viewMode === 'list-cover' ? 60 : 44}
                  getKey={(it) => it.id}
                  renderItem={(it) => (
                    <ItemRow
                      item={it}
                      showCover={viewMode === 'list-cover'}
                    />
                  )}
                />
              </GroupBlock>
            ))
        ) : viewMode === 'table' ? (
          <BookTable items={flatItems} />
        ) : viewMode === 'grid' ? (
          <BookGrid items={flatItems} />
        ) : (
          <BookWall items={flatItems} />
        )}
      </div>
    </section>
  );
}
