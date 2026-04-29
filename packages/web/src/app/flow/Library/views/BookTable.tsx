import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import { useLibraryActions } from '../context';
import { authorsLabel, languageLabel } from '../lib/labels';
import type { LibraryItem } from '../lib/types';
import FilterableCell from './FilterableCell';

interface BookTableProps {
  items: LibraryItem[];
}

type TableSortColumn = 'title' | 'author' | 'publisher' | 'language' | 'year';

interface TableSort {
  column: TableSortColumn;
  direction: 'asc' | 'desc';
}

const TABLE_COLUMNS: ReadonlyArray<{
  id: TableSortColumn;
  label: string;
  className: string;
}> = [
  { id: 'title', label: 'Titre', className: 'py-2 pr-3' },
  { id: 'author', label: 'Auteur·rice', className: 'px-3 py-2' },
  { id: 'publisher', label: 'Éditeur', className: 'px-3 py-2' },
  { id: 'language', label: 'Langue', className: 'px-3 py-2' },
  { id: 'year', label: 'Année', className: 'px-3 py-2' },
];

function valueForSort(it: LibraryItem, column: TableSortColumn): string | number {
  switch (column) {
    case 'title':
      return it.title.toLocaleLowerCase('fr');
    case 'author':
      return authorsLabel(it).toLocaleLowerCase('fr');
    case 'publisher':
      return (it.publisher?.trim() ?? '').toLocaleLowerCase('fr');
    case 'language':
      return languageLabel(it.language).toLocaleLowerCase('fr');
    case 'year':
      return it.year ?? -Infinity;
  }
}

/**
 * Dense table view — one book per row, five columns (titre /
 * auteur·rice / éditeur / langue / année). Cells in the four
 * meta-columns are clickable filter triggers ; the title cell still
 * opens the Composer in edit mode.
 *
 * Column headers cycle through asc → desc → null on click — null
 * restores the incoming order (the catalogue's natural sort).
 * Empty values always sink to the bottom regardless of direction
 * so a row without an éditeur or langue doesn't bubble up to the
 * top of an asc sort.
 *
 * Like the grid + wall views, this mode flattens the status
 * grouping — a real table with a status column would invite sorting
 * features later, but for now the existing « par statut » filter
 * chips on the SideColumn cover the same need without breaking the
 * table's visual rhythm.
 */
export default function BookTable({ items }: BookTableProps) {
  const { editItem } = useLibraryActions();
  const [sort, setSort] = useState<TableSort | null>(null);

  function handleSortClick(col: TableSortColumn): void {
    setSort((prev) => {
      if (!prev || prev.column !== col) return { column: col, direction: 'asc' };
      if (prev.direction === 'asc') return { column: col, direction: 'desc' };
      return null;
    });
  }

  const sortedItems = useMemo<LibraryItem[]>(() => {
    if (!sort) return items;
    const out = [...items];
    out.sort((a, b) => {
      const av = valueForSort(a, sort.column);
      const bv = valueForSort(b, sort.column);
      // Empty / missing values always sink to the bottom — both
      // strings and the year sentinel `-Infinity` are detected.
      const aEmpty = av === '' || av === -Infinity;
      const bEmpty = bv === '' || bv === -Infinity;
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), 'fr');
      }
      return sort.direction === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [items, sort]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px] text-ink">
        <thead>
          <tr className="border-b border-hair text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
            {TABLE_COLUMNS.map((col) => {
              const active = sort?.column === col.id;
              const ascActive = active && sort.direction === 'asc';
              const descActive = active && sort.direction === 'desc';
              return (
                <th key={col.id} className={cn(col.className, 'font-semibold')}>
                  <button
                    type="button"
                    onClick={() => handleSortClick(col.id)}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 uppercase tracking-[0.04em] transition-colors',
                      active ? 'text-ink' : 'text-muted hover:text-ink',
                    )}
                    aria-sort={
                      active
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    {col.label}
                    {/* Stacked double-arrow affordance — always
                        rendered on every column header. The active
                        arrow takes the ink colour ; the inactive one
                        falls back to a faint hair tint so the column
                        still reads as sortable when nothing is
                        sorted. */}
                    <span
                      aria-hidden="true"
                      className="inline-flex flex-col items-center leading-[0.6]"
                    >
                      <span
                        className={cn(
                          'text-[8px] transition-colors',
                          ascActive ? 'text-ink' : 'text-hair',
                        )}
                      >
                        ▲
                      </span>
                      <span
                        className={cn(
                          'text-[8px] transition-colors',
                          descActive ? 'text-ink' : 'text-hair',
                        )}
                      >
                        ▼
                      </span>
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((it) => {
            const author = authorsLabel(it);
            const publisher = it.publisher?.trim() ?? '';
            const langCode = it.language?.toLowerCase() ?? '';
            const yearStr = it.year != null ? String(it.year) : '';
            return (
              <tr
                key={it.id}
                className="border-b border-hair last:border-b-0 transition-colors hover:bg-bg-2"
              >
                <td className="py-2 pr-3">
                  <button
                    type="button"
                    onClick={() => editItem(it)}
                    className="block w-full cursor-pointer truncate text-left font-medium text-ink transition-colors hover:text-accent"
                    title="Modifier ce livre"
                  >
                    {it.title}
                  </button>
                </td>
                <td className="px-3 py-2 text-ink-soft">
                  <FilterableCell
                    field="author"
                    value={author}
                    className="block truncate"
                  />
                </td>
                <td className="px-3 py-2 text-ink-soft">
                  <FilterableCell
                    field="publisher"
                    value={publisher}
                    className="block truncate"
                  />
                </td>
                <td className="px-3 py-2 text-ink-soft">
                  <FilterableCell
                    field="language"
                    value={langCode}
                    display={languageLabel(it.language)}
                  />
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-soft">
                  <FilterableCell field="year" value={yearStr} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
