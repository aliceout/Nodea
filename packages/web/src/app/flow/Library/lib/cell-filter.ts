import type { LibraryItem } from './types';

/**
 * Filterable axes surfaced by the Tableau / Liste cells. Clicking a
 * cell applies a `CellFilter` at top-level state ; the catalogue
 * narrows down via `matchesCellFilter`. The active filter is shown
 * as a banner above the list with an « × » to clear.
 */
export type CellFilterField = 'author' | 'publisher' | 'language' | 'year';

export interface CellFilter {
  field: CellFilterField;
  /** String for « author » / « publisher » / « language », canonical
   *  year string (e.g. "2022") for « year ». */
  value: string;
}

/** FR display label for each axis, shown in the active-filter banner. */
export const CELL_FILTER_LABEL: Record<CellFilterField, string> = {
  author: 'Auteur·rice',
  publisher: 'Éditeur',
  language: 'Langue',
  year: 'Année',
};

/**
 * Does this item match the active cell filter ? Used by the catalogue's
 * `filteredItems` memo. Author match is exact-string against any of
 * the item's authors (role unset or `'author'`) ; publisher /
 * language match the trimmed string ; year compares the canonical
 * year string ("2022", not 2022).
 */
export function matchesCellFilter(item: LibraryItem, filter: CellFilter): boolean {
  switch (filter.field) {
    case 'author': {
      const authors = item.creators
        ?.filter((c) => !c.role || c.role === 'author')
        .map((c) => c.name.trim())
        .filter(Boolean);
      return Boolean(authors?.includes(filter.value));
    }
    case 'publisher':
      return (item.publisher?.trim() ?? '') === filter.value;
    case 'language':
      return (item.language?.toLowerCase() ?? '') === filter.value.toLowerCase();
    case 'year':
      return item.year != null && String(item.year) === filter.value;
  }
}
