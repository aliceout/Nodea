import { cn } from '@/lib/utils';

import { useLibraryFilters } from '../context';
import {
  CELL_FILTER_LABEL,
  type CellFilterField,
} from '../lib/cell-filter';

interface FilterableCellProps {
  field: CellFilterField;
  /** Canonical filter value (e.g. `"2022"` for year, the raw
   *  language code for `language`). The button's title and the
   *  resulting filter use this. */
  value: string;
  /** Optional label rendered in place of `value` (e.g. « Français »
   *  for `'fr'`). Falls back to `value` when omitted. */
  display?: string;
  className?: string;
}

/**
 * Inline button styled to read like plain text — clicking sets the
 * matching cell filter on the catalogue. Empty values render as a
 * non-clickable « — » so empty cells don't pretend to be filterable.
 *
 * Reads `setCellFilter` from `useLibraryFilters()` ; consumers don't
 * have to thread the callback through.
 */
export default function FilterableCell({
  field,
  value,
  display,
  className,
}: FilterableCellProps) {
  const { setCellFilter } = useLibraryFilters();
  if (!value) {
    return <span className={cn('text-muted', className)}>—</span>;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setCellFilter({ field, value });
      }}
      className={cn(
        'cursor-pointer text-left transition-colors hover:text-accent hover:underline underline-offset-2',
        className,
      )}
      title={`Filtrer sur ${CELL_FILTER_LABEL[field]} : ${display ?? value}`}
    >
      {display ?? value}
    </button>
  );
}
