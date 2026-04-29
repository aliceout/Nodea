import {
  ListBulletIcon,
  QueueListIcon,
  RectangleGroupIcon,
  Squares2X2Icon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

import { cn } from '@/lib/utils';

import { useLibraryFilters, type LibraryViewMode } from '../context';

const VIEW_MODE_DEFS: ReadonlyArray<{
  id: LibraryViewMode;
  label: string;
  Icon: typeof ListBulletIcon;
}> = [
  { id: 'list-plain', label: 'Liste compacte', Icon: ListBulletIcon },
  { id: 'list-cover', label: 'Liste avec couverture', Icon: QueueListIcon },
  { id: 'table', label: 'Tableau', Icon: TableCellsIcon },
  { id: 'grid', label: 'Grille', Icon: Squares2X2Icon },
  { id: 'wall', label: 'Mur de couvertures', Icon: RectangleGroupIcon },
];

/** Catalogue rendering-mode picker — five icons in a hairline pill,
 *  active state on the current mode. Reads `viewMode` /
 *  `setViewMode` from the filters context ; no props. */
export default function ViewModeToggle() {
  const { viewMode, setViewMode } = useLibraryFilters();
  return (
    <div
      role="radiogroup"
      aria-label="Mode d'affichage"
      className="flex items-center gap-0.5 rounded-sm border border-hair bg-bg-2/60 p-0.5"
    >
      {VIEW_MODE_DEFS.map(({ id, label, Icon }) => {
        const active = viewMode === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setViewMode(id)}
            className={cn(
              'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[5px] transition-colors',
              active
                ? 'bg-bg text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                : 'text-muted hover:bg-bg hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
