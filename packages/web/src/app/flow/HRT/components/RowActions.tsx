/**
 * HRT · RowActions — the edit / delete icon-button pair at the end of
 * every list row (admin logs, lab results, products).
 *
 * Always visible on mobile (`< md`) : touch devices have no hover, and
 * Tailwind's `hover` never fires on tap, so a hover-only reveal left
 * the controls unreachable on phones (« on voit pas les boutons »).
 * On mobile they stack vertically (one icon wide, not two) so the row
 * keeps its width for the entry text. From `md+` they sit side by side
 * and fade in on row hover / focus-within, the original desktop
 * behaviour.
 *
 * Factored out because all three HRT lists render the exact same
 * controls ; keeping one component means the reveal, the a11y labels
 * and the danger styling stay in sync across the module.
 */
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
}

export default function RowActions({ onEdit, onDelete }: RowActionsProps) {
  const { t } = useI18n();
  return (
    <div className="flex shrink-0 flex-col gap-1 opacity-100 transition-opacity md:flex-row md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
      <Button variant="ghost" size="sm" iconOnly aria-label={t('common.actions.edit')} onClick={onEdit}>
        <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        variant="danger-ghost"
        size="sm"
        iconOnly
        aria-label={t('common.actions.delete')}
        onClick={onDelete}
      >
        <TrashIcon className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
