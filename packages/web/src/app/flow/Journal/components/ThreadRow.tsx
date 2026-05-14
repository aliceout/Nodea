import type { KeyboardEvent } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

interface ThreadRowProps {
  name: string;
  isEditing: boolean;
  working: boolean;
  draftName: string;
  setDraftName: (next: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
}

/**
 * Single row of the threads manager modal — the thread name (or
 * inline input when editing) and the per-row rename / delete
 * actions. The parent modal owns the `editingName` state so only
 * one row can be in rename mode at a time.
 *
 * Merge UX intentionally drops the multi-select checkbox flow :
 * renaming a thread into a name that already exists is a de facto
 * merge (the underlying `renameThreadInString` dedups on
 * collision). Two renames to chain merges feel cheaper than a
 * dedicated multi-select bar for what's a rare operation.
 */
export default function ThreadRow({
  name,
  isEditing,
  working,
  draftName,
  setDraftName,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
}: ThreadRowProps) {
  const { t } = useI18n();

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
          aria-label={t('journal.threadsManager.renameAria', {
            values: { name },
          })}
        >
          <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          variant="danger-ghost"
          size="sm"
          iconOnly
          onClick={onDelete}
          disabled={working}
          aria-label={t('journal.threadsManager.deleteAria', {
            values: { name },
          })}
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
