import type { KeyboardEvent } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import { formatNumber, formatPartialDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

import type { ThreadStats } from '../lib/thread-stats';

interface ThreadRowProps {
  row: ThreadStats;
  isEditing: boolean;
  isSelected: boolean;
  working: boolean;
  draftName: string;
  setDraftName: (next: string) => void;
  onSelectToggle: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
}

/**
 * Single row of the threads manager modal — the thread name (or
 * inline input when editing), per-thread stats (entries / words /
 * date range), and per-row actions (rename, delete, select for
 * merge). Read-only outside of editing ; the parent modal owns
 * the editing-name state so only one row can be in rename mode at
 * a time.
 */
export default function ThreadRow({
  row,
  isEditing,
  isSelected,
  working,
  draftName,
  setDraftName,
  onSelectToggle,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
}: ThreadRowProps) {
  const { t, language } = useI18n();
  const statRange =
    row.firstDateIso && row.lastDateIso
      ? `${formatPartialDate(row.firstDateIso, language)} → ${formatPartialDate(row.lastDateIso, language)}`
      : null;

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
    <li className="flex items-start gap-3 py-2.5">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onSelectToggle}
        disabled={working || isEditing}
        aria-label={t('journal.threadsManager.selectAria', {
          values: { name: row.name },
        })}
        className="mt-1 h-3.5 w-3.5"
      />
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
          <p className="text-[13.5px] font-medium text-ink">{row.name}</p>
        )}
        <p className="mt-0.5 text-[11.5px] text-muted">
          {t('journal.threadsManager.rowStats', {
            values: {
              count: row.entryCount,
              words: formatNumber(row.totalWords, language),
            },
          })}
          {statRange ? <> · {statRange}</> : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onStartRename}
          disabled={working}
          aria-label={t('journal.threadsManager.renameAria', {
            values: { name: row.name },
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
            values: { name: row.name },
          })}
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
