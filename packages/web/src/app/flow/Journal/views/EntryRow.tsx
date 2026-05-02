import {
  BookOpenIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import HoverActions from '@/ui/dirk/module/HoverActions';

import { useJournalActions } from '../context';
import { attachmentSrc } from '../hooks/imageResize';
import type { JournalEntry } from '../lib/types';
import ClampedJournalContent from './ClampedJournalContent';

interface EntryRowProps {
  entry: JournalEntry;
}

/**
 * One row of the Journal list — date label on the left (clickable
 * to open the reader), title + clamped content + attachment thumbs
 * in the middle, hover-revealed read / edit / delete affordances
 * on the right. Reads `openReader` / `editEntry` / `deleteEntry`
 * from the actions context ; only the entry comes in as a prop.
 */
export default function EntryRow({ entry }: EntryRowProps) {
  const { t } = useI18n();
  const { openReader, editEntry, deleteEntry } = useJournalActions();
  const onRead = () => openReader(entry.id);

  return (
    <li className="group flex items-start gap-4 border-b border-hair py-4 last:border-b-0">
      <button
        type="button"
        onClick={onRead}
        className="w-[110px] shrink-0 cursor-pointer text-left text-[12px] tabular-nums text-muted transition-colors hover:text-accent"
        aria-label={t('passage.row.openAria', {
          values: { label: entry.title ?? entry.dateLabel },
        })}
      >
        {entry.dateLabel}
      </button>

      <div className="min-w-0 flex-1">
        {entry.title ? (
          <p className="mb-1 text-[14px] font-medium text-ink">{entry.title}</p>
        ) : null}
        <ClampedJournalContent text={entry.content} onExpand={onRead} />
        {entry.attachments.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.attachments.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={onRead}
                className="h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-sm border border-hair bg-bg-2 transition-opacity hover:opacity-80"
                aria-label={t('passage.row.imageAria')}
                title={t('passage.row.imageTitle')}
              >
                <img
                  src={attachmentSrc(att)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <HoverActions>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onRead}
          aria-label={t('passage.row.readAria')}
          title={t('passage.row.readTitle')}
        >
          <BookOpenIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => editEntry(entry)}
          aria-label={t('passage.row.editAria')}
          title={t('common.actions.edit')}
        >
          <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          variant="danger-ghost"
          size="sm"
          iconOnly
          onClick={() => void deleteEntry(entry)}
          aria-label={t('passage.row.deleteAria')}
          title={t('common.actions.delete')}
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </HoverActions>
    </li>
  );
}
