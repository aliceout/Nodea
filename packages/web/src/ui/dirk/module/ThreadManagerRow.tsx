import type { KeyboardEvent } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import Button from '@/ui/atoms/dirk/Button';

/**
 * Single row of the generic thread/theme manager modal — the name (or
 * inline input when editing) plus per-row rename / delete actions. The
 * parent modal owns the `editingName` state so only one row edits at a
 * time. aria labels are passed in (already resolved) so the row stays
 * module-agnostic — Journal feeds « fil » wording, Goals « thème ».
 *
 * Merge UX intentionally drops the multi-select checkbox flow: renaming
 * a name into one that already exists is a de facto merge (the
 * underlying `renameThreadInString` dedups on collision).
 */
interface ThreadManagerRowProps {
  name: string;
  isEditing: boolean;
  working: boolean;
  draftName: string;
  setDraftName: (next: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  /** Already-resolved aria-label for the rename button (e.g. with the
   *  name interpolated). */
  renameAria: string;
  deleteAria: string;
}

export default function ThreadManagerRow({
  name,
  isEditing,
  working,
  draftName,
  setDraftName,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
  renameAria,
  deleteAria,
}: ThreadManagerRowProps) {
  function onRenameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelRename();
    }
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input
            type="text"
            value={draftName}
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={onRenameKeyDown}
            onBlur={onCommitRename}
            disabled={working}
            className="w-full rounded-sm border-b border-accent bg-transparent text-[13.5px] font-medium text-ink outline-none"
          />
        ) : (
          <p className="text-[13.5px] font-medium text-ink">{name}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onStartRename}
          disabled={working}
          aria-label={renameAria}
        >
          <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          variant="danger-ghost"
          size="sm"
          iconOnly
          onClick={onDelete}
          disabled={working}
          aria-label={deleteAria}
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
