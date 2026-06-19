import { memo } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { splitThreads } from '@nodea/shared';

import { formatPartialDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import HoverActions from '@/ui/dirk/module/HoverActions';

import { useGoalsActions } from '../context';
import type { GoalEntry } from '../lib/types';
import StatusPill from './StatusPill';

interface GoalCardProps {
  entry: GoalEntry;
}

/**
 * One card in the « Cartes » view of Goals.
 *
 * Layout intent : the card stands on its own (no row context), so the
 * status pill and hover actions live on the same line at the top
 * (pill on the left, edit / delete on the right), then the title +
 * date below, then the note as a 4-line clamped preview. The whole
 * card is clickable through the title button — opens the reader
 * shell, same affordance as the list view.
 *
 * Memoised so a sibling-card mutation (status cycle, delete) only
 * re-renders the affected card. Without `memo`, every card re-runs
 * its render on every actions-context update.
 */
function GoalCardImpl({ entry }: GoalCardProps) {
  const { t, language } = useI18n();
  const { editEntry, deleteEntry, openReader } = useGoalsActions();
  const threads = splitThreads(entry.thread);

  return (
    <article className="group relative flex h-full flex-col rounded-md border border-hair bg-bg p-4 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      {/* Edit / delete affordances in the top-right corner, hidden
          until hover — same posture as Library's BookGrid hover bar. */}
      <HoverActions className="absolute right-3 top-3">
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

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => openReader(entry.id)}
          title={t('goals.row.titleClickHint')}
          className="cursor-pointer rounded-sm bg-transparent py-0 pl-0 pr-14 text-left text-[14px] font-semibold leading-snug text-ink transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {entry.title}
        </button>
        {/* Meta line : date · thread(s) on the left, the status tag
            pushed to the right (same sage Tag as Journal's threads). */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
          {entry.date ? (
            <span className="tabular-nums">
              {formatPartialDate(entry.date, language)}
            </span>
          ) : null}
          {entry.date && threads.length > 0 ? (
            <span aria-hidden="true">·</span>
          ) : null}
          {threads.map((th, i) => (
            <span key={th}>
              {i > 0 ? <span aria-hidden="true">, </span> : null}
              {th}
            </span>
          ))}
          <span className="ml-auto">
            <StatusPill entry={entry} />
          </span>
        </div>
        {entry.note ? (
          <p className="mt-3 line-clamp-4 text-[12.5px] leading-[1.5] text-ink-soft">
            {entry.note}
          </p>
        ) : null}
      </div>
    </article>
  );
}

const GoalCard = memo(GoalCardImpl);
export default GoalCard;
