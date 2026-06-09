import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import { formatPartialDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import HoverActions from '@/ui/dirk/module/HoverActions';

import { useGoalsActions } from '../context';
import type { GoalEntry } from '../lib/types';
import StatusPill from './StatusPill';

interface GoalRowProps {
  entry: GoalEntry;
}

/**
 * One row of the Goals list — the inline status pill on the LEFT
 * (clickable to cycle) with the hover-revealed edit / delete
 * affordances stacked under it, then title + date + note filling
 * the rest of the row. Reads the actions from the Goals context ;
 * only the entry itself comes in as a prop.
 *
 * Quick-rename (issue #65) — double-click on the title swaps the
 * static `<p>` for an `<input>` and routes the change through
 * `updateTitle` (single-field optimistic update). Enter / blur
 * commits, Escape cancels. Empty / unchanged values short-circuit.
 * The pencil icon in `HoverActions` still opens the full composer
 * for date / note / status / thread edits.
 *
 * Wrapped in `React.memo` so a sibling-entry change (status
 * cycle, inline rename, delete) only re-renders the row whose
 * `entry` reference moved. Without it, every keystroke into one
 * row's inline-edit input re-renders every other row through the
 * actions context, jankying scroll at high entry counts.
 */
function GoalRowImpl({ entry }: GoalRowProps) {
  const { t, language } = useI18n();
  const { editEntry, updateTitle, deleteEntry, openReader } = useGoalsActions();

  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(entry.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // When the editing flag flips on, focus + select the input so the
  // user can type over the existing title immediately.
  useEffect(() => {
    if (editingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTitle]);

  function startInlineEdit() {
    setDraftTitle(entry.title);
    setEditingTitle(true);
  }

  function commitInlineEdit() {
    if (!editingTitle) return;
    setEditingTitle(false);
    // `updateTitle` itself bails on empty / unchanged inputs ; the
    // optimistic state inside actions handles the rollback if the
    // server rejects. We don't need to await here — the row stays
    // responsive even if the network round-trip is slow.
    void updateTitle(entry, draftTitle);
  }

  function cancelInlineEdit() {
    setEditingTitle(false);
    setDraftTitle(entry.title);
  }

  function onTitleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitInlineEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelInlineEdit();
    }
  }

  return (
    <article className="group flex items-start gap-5 border-b border-hair py-3 last:border-b-0">
      {/* Status pill + hover actions live on the LEFT of the row :
          the pill is read first (sage check = win) and the title
          follows as the achievement text. Aligning to `items-start`
          keeps the pill flush with the title's baseline rather
          than centred against the (variably tall) title + note
          block. */}
      <div className="flex shrink-0 flex-col items-start gap-1.5">
        <StatusPill entry={entry} />
        <HoverActions>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => editEntry(entry)}
            aria-label={t('goals.row.editAria')}
            title={t('common.actions.edit')}
          >
            <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="danger-ghost"
            size="sm"
            iconOnly
            onClick={() => void deleteEntry(entry)}
            aria-label={t('goals.row.deleteAria')}
            title={t('common.actions.delete')}
          >
            <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </HoverActions>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          {editingTitle ? (
            <input
              ref={inputRef}
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={onTitleKeyDown}
              onBlur={commitInlineEdit}
              aria-label={t('goals.row.titleEditAria')}
              className="min-w-0 flex-1 border-b border-accent bg-transparent text-[14px] font-medium text-ink outline-none focus:border-accent"
            />
          ) : (
            <button
              type="button"
              onClick={() => openReader(entry.id)}
              onDoubleClick={startInlineEdit}
              title={t('goals.row.titleClickHint')}
              // No strike-through / muting on `done` — Goals is a
              // log of the year's wins, not a task tracker, so a
              // completed goal should read at full weight just like
              // an open or in-progress one. The StatusPill (sage
              // filled with a white check) on the left carries the
              // « achievement » signal.
              className="cursor-pointer rounded-sm bg-transparent p-0 text-left text-[14px] font-medium text-ink transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {entry.title}
            </button>
          )}
          {entry.date ? (
            <span className="text-[11px] tabular-nums text-muted">
              {formatPartialDate(entry.date, language)}
            </span>
          ) : null}
        </div>
        {entry.note ? (
          <p className="mt-1 text-[13px] leading-[1.5] text-ink-soft">{entry.note}</p>
        ) : null}
      </div>
    </article>
  );
}

const GoalRow = memo(GoalRowImpl);
export default GoalRow;
