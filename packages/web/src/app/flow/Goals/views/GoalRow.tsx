import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import HoverActions from '@/ui/dirk/HoverActions';
import { cn } from '@/lib/utils';

import { useGoalsActions } from '../context';
import { formatDate } from '../lib/date-format';
import type { GoalEntry } from '../lib/types';
import StatusPill from './StatusPill';

interface GoalRowProps {
  entry: GoalEntry;
}

/**
 * One row of the Goals list — title + date + note, the inline
 * status pill on the right (clickable to cycle), and hover-revealed
 * edit / delete affordances. Reads the actions from the Goals
 * context ; only the entry itself comes in as a prop.
 */
export default function GoalRow({ entry }: GoalRowProps) {
  const { t } = useI18n();
  const { editEntry, deleteEntry } = useGoalsActions();
  return (
    <li className="group flex items-start gap-3 border-b border-hair py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <p
            className={cn(
              'text-[14px] font-medium transition-colors',
              entry.status === 'done' ? 'text-muted line-through' : 'text-ink',
            )}
          >
            {entry.title}
          </p>
          {entry.date ? (
            <span className="text-[11px] tabular-nums text-muted">
              {formatDate(entry.date)}
            </span>
          ) : null}
        </div>
        {entry.note ? (
          <p className="mt-1 text-[13px] leading-[1.5] text-ink-soft">{entry.note}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
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
    </li>
  );
}
