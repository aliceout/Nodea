/**
 * HRT · RowActions — the edit / delete icon-button pair shown on hover
 * at the end of every list row (admin logs, lab results, products).
 *
 * Factored out because all three HRT lists render the exact same hover
 * controls ; keeping one component means the hover/focus reveal, the
 * a11y labels and the danger styling stay in sync across the module.
 */
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import Button from '@/ui/atoms/dirk/Button';

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
}

export default function RowActions({ onEdit, onDelete }: RowActionsProps) {
  return (
    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <Button variant="ghost" size="sm" iconOnly aria-label="Modifier" onClick={onEdit}>
        <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant="danger-ghost"
        size="sm"
        iconOnly
        aria-label="Supprimer"
        onClick={onDelete}
      >
        <TrashIcon className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
