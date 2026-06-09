import { memo } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import HoverActions from '@/ui/dirk/module/HoverActions';

import NoteBadge from '../components/NoteBadge';
import { useMoodActions } from '../context';
import type { MoodEntry } from '../lib/types';

/** One row of the Mood entry list. Date label · score badge ·
 *  positives + optional comment + optional Q/A · hover actions
 *  (edit / delete). The actions read from the actions context so
 *  the row only needs the entry as a prop.
 *
 *  Layout : a single CSS grid that re-flows at the `md` breakpoint.
 *  - Below `md` (phones) : 2 rows × 2 cols. Row 1 = date pinned
 *    left, score badge pinned right (`grid-cols-[1fr_auto]`,
 *    vertically centred). Row 2 = body spanning both columns,
 *    flush-left so positives + question + comment align with the
 *    date above. Hover actions are dropped on mobile — they were
 *    invisible anyway (`opacity-0` until hover, which doesn't
 *    fire on touch) so the affordance was already missing ; a
 *    real mobile edit/delete path is a separate concern.
 *  - `md+` : the historical 4-col single row (110 px date,
 *    44 px badge, 1 fr body, auto actions).
 *
 *  Wrapped in `React.memo` so a sibling-entry change (cycle status,
 *  inline edit, delete) only re-renders the row whose `entry`
 *  reference moved. Without it, every keystroke / status flip
 *  through the actions context invalidates the whole list and
 *  scrolls become janky at 10k entries.
 */
function EntryRowImpl({ entry }: { entry: MoodEntry }) {
  const { t } = useI18n();
  const { editEntry, deleteEntry } = useMoodActions();

  return (
    <article className="group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-b border-hair py-4 md:grid-cols-[110px_44px_1fr_auto] md:items-baseline md:gap-x-4 md:gap-y-0">
      <div className="col-start-1 row-start-1 text-[12px] tabular-nums text-muted">
        {entry.date}
      </div>
      <div className="col-start-2 row-start-1">
        <NoteBadge score={entry.score} />
      </div>
      <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-3 md:row-start-1">
        <ul className="space-y-0.5">
          {entry.positives
            .filter((p) => p.trim().length > 0)
            .map((p, i) => (
              <li
                key={i}
                className="flex items-baseline gap-2 text-[13px] leading-[1.5] text-ink"
              >
                {/* Bullet marker only on desktop — on mobile the
                    body is in its own row and the leading « · »
                    would push the text out of alignment with the
                    date above, which the user explicitly called
                    out. */}
                <span aria-hidden="true" className="mt-0.5 hidden text-[10px] text-muted md:inline">
                  ·
                </span>
                <span>{p}</span>
              </li>
            ))}
        </ul>
        {entry.comment ? (
          <p className="mt-1.5 text-[13px] italic leading-[1.5] text-ink-soft">
            {entry.comment}
          </p>
        ) : null}
        {entry.question ? (
          <div className="mt-1.5 text-[13px] leading-[1.5] text-muted">
            <span className="font-semibold tracking-[0.02em]">{t('mood.row.questionMarker')}</span>{' '}
            <span className="italic">{entry.question}</span>
            {entry.answer ? (
              <>
                {' — '}
                <span className="text-ink">{entry.answer}</span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* `display: contents` on md+ promotes HoverActions to a
          grid child ; below md the wrapper is hidden and the
          actions don't render at all. */}
      <div className="hidden md:contents">
        <HoverActions className="col-start-4 row-start-1">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => editEntry(entry)}
            aria-label={t('mood.row.editAria')}
            title={t('common.actions.edit')}
          >
            <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="danger-ghost"
            size="sm"
            iconOnly
            onClick={() => {
              void deleteEntry(entry);
            }}
            aria-label={t('mood.row.deleteAria')}
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
