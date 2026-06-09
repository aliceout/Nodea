import FilterChip from '@/ui/dirk/module/FilterChip';

import { useLibraryFilters, type LibraryViewMode } from '../context';

const VIEW_MODE_DEFS: ReadonlyArray<{ id: LibraryViewMode; label: string }> = [
  { id: 'list-plain', label: 'Compacte' },
  { id: 'list-cover', label: 'Couvertures' },
  { id: 'table', label: 'Tableau' },
  { id: 'grid', label: 'Grille' },
  { id: 'wall', label: 'Mur' },
];

/** Catalogue rendering-mode picker — five `FilterChip`s so it stacks
 *  cleanly with the other sidebar sections (« Grouper par »,
 *  « Statut », « Tags ») which all use the same chip atom. Reads
 *  `viewMode` / `setViewMode` from the filters context ; no props. */
export default function ViewModeToggle() {
  const { viewMode, setViewMode } = useLibraryFilters();
  return (
    <div className="flex flex-wrap gap-1">
      {VIEW_MODE_DEFS.map(({ id, label }) => (
        <FilterChip
          key={id}
          active={viewMode === id}
          onClick={() => setViewMode(id)}
          label={label}
        />
      ))}
    </div>
  );
}
