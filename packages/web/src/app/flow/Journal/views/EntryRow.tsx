import { memo } from 'react';
import {
  BookOpenIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { splitThreads } from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import HoverActions from '@/ui/dirk/module/HoverActions';
import Tag from '@/ui/dirk/module/Tag';

import { useJournalActions } from '../context';
import { attachmentSrc } from '../hooks/imageResize';
import type { JournalEntry } from '../lib/types';
import ClampedJournalContent from './ClampedJournalContent';

interface EntryRowProps {
  entry: JournalEntry;
  /** Render the entry's thread(s) as inline chips. On in the
   *  by-month view (where the thread is no longer the group header)
   *  so the grouping doesn't hide it ; off in the by-thread view
   *  where the header already names it. */
  showThread?: boolean;
  /** Last entry of its group — drops the bottom separator so it
   *  doesn't double up with the next month/thread header's border. */
  isLast?: boolean;
}

/**
 * One row of the Journal list — date label on the left (clickable
 * to open the reader), title + clamped content + attachment thumbs
 * in the middle, hover-revealed read / edit / delete affordances
 * on the right. Reads `openReader` / `editEntry` / `deleteEntry`
 * from the actions context ; only the entry comes in as a prop.
 *
 * Layout : flex column below `md` (date sits on its own line, body
 * + thumbs span the full width underneath) so the snippet doesn't
 * end up squeezed into ~150 px on a phone ; the historical
 * `flex-row gap-4` layout returns at `md+`. Hover actions are
 * dropped on mobile via `hidden md:contents` since the underlying
 * `HoverActions` cluster relies on `group-hover` which never fires
 * on touch — a real touch path is a separate concern.
 *
 * Wrapped in `React.memo` so a sibling-entry change (delete,
 * edit) only re-renders the row whose `entry` reference moved.
 * Without it, every other-row action through the actions context
 * invalidates the whole list and re-renders all rows including
 * the (potentially heavy) ClampedJournalContent on each.
 */
function EntryRowImpl({ entry, showThread = false, isLast = false }: EntryRowProps) {
  const { t } = useI18n();
  const { openReader, editEntry, deleteEntry } = useJournalActions();
  const onRead = () => openReader(entry.id);
  const threads = showThread ? splitThreads(entry.thread) : [];

  return (
    <article className="group relative flex flex-col gap-1.5 pt-4 md:flex-row md:items-start md:gap-4">
      {/* Whole-entry click target → the reader. A real absolute
          overlay button (not a `::after`, which needs a `content`
          and rendered unreliably) covers the row ; the body can't
          itself be a button since LiteMarkdown may render links.
          `z-[1]` lifts it above the clamped body's own `relative`
          wrapper (used for the fade) so the TEXT zone is clickable,
          not just the static date ; attachments + hover actions ride
          above the overlay at `z-[2]`. */}
      <button
        type="button"
        onClick={onRead}
        aria-label={t('journal.row.openAria', {
          values: { label: entry.title ?? entry.dateLabel },
        })}
        className="absolute inset-0 z-[1] cursor-pointer rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      />

      <div className="md:w-[110px] md:shrink-0">
        <p className="text-[12px] tabular-nums text-muted transition-colors group-hover:text-accent">
          {entry.dateLabel}
        </p>
        {threads.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {threads.map((th) => (
              <Tag key={th}>{th}</Tag>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className={`min-w-0 pb-4 md:flex-1 ${isLast ? '' : 'border-b border-hair'}`}
      >
        {entry.title ? (
          <p className="mb-1 text-[14px] font-medium text-ink">{entry.title}</p>
        ) : null}
        <ClampedJournalContent text={entry.content} />
        {entry.attachments.length > 0 ? (
          <div className="relative z-[2] mt-2 flex flex-wrap gap-1.5">
            {entry.attachments.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={onRead}
                className="h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-sm border border-hair bg-bg-2 transition-opacity hover:opacity-80"
                aria-label={t('journal.row.imageAria')}
                title={t('journal.row.imageTitle')}
              >
                <img
                  src={attachmentSrc(att)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="hidden md:contents">
        <HoverActions className="relative z-[2]">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={onRead}
            aria-label={t('journal.row.readAria')}
            title={t('journal.row.readTitle')}
          >
            <BookOpenIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => editEntry(entry)}
            aria-label={t('journal.row.editAria')}
            title={t('common.actions.edit')}
          >
            <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="danger-ghost"
            size="sm"
            iconOnly
            onClick={() => void deleteEntry(entry)}
            aria-label={t('journal.row.deleteAria')}
            title={t('common.actions.delete')}
          >
            <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </HoverActions>
      </div>
    </article>
  );
}

const EntryRow = memo(EntryRowImpl);
export default EntryRow;
