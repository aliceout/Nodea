import { memo, type ReactNode } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { MoodEntryLead } from '@nodea/shared';

import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import HoverActions from '@/ui/dirk/module/HoverActions';

import NoteBadge from '../components/NoteBadge';
import { useMoodActions } from '../context';
import { moodEntryOrder } from '../lib/placements';
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
  // Which block leads the row (display order only — the composer order is
  // fixed). Read as a primitive so a lead change re-renders the rows but an
  // unrelated pref write doesn't; the memo still guards entry-data changes.
  const lead = useNodeaStore((s) => s.preferences.moodEntryLead ?? 'positives');

  const filledPositives = entry.positives.filter((p) => p.trim().length > 0);
  const blocks: Record<MoodEntryLead, ReactNode> = {
    positives:
      filledPositives.length > 0 ? (
        <ul key="positives" className="space-y-0.5">
          {filledPositives.map((p, i) => (
            <li key={i} className="flex items-baseline gap-2 text-[13px] leading-[1.5] text-ink">
              {/* Bullet only on desktop — on mobile the body is its own row and
                  a leading « · » would break alignment with the date above. */}
              <span
                aria-hidden="true"
                className="mt-0.5 hidden shrink-0 text-[10px] text-muted md:inline"
              >
                ·
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      ) : null,
    comment: entry.comment ? (
      <div
        key="comment"
        className="flex items-baseline gap-2 text-[13px] italic leading-[1.5] text-ink-soft"
      >
        <span aria-hidden="true" className="hidden shrink-0 text-[10px] md:inline invisible">
          ·
        </span>
        <span>{entry.comment}</span>
      </div>
    ) : null,
    question: entry.question ? (
      <div
        key="question"
        className="flex items-baseline gap-2 text-[13px] leading-[1.5] text-muted"
      >
        <span aria-hidden="true" className="hidden shrink-0 text-[10px] md:inline invisible">
          ·
        </span>
        <div>
          <span className="font-semibold tracking-[0.02em]">{t('mood.row.questionMarker')}</span>{' '}
          <span className="italic">{entry.question}</span>
          {entry.answer ? (
            <>
              {' — '}
              <span className="text-ink">{entry.answer}</span>
            </>
          ) : null}
        </div>
      </div>
    ) : null,
  };

  return (
    <article className="group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-b border-hair py-4 md:grid-cols-[110px_44px_1fr_auto] md:items-baseline md:gap-x-4 md:gap-y-0">
      <div className="col-start-1 row-start-1 text-[12px] tabular-nums text-muted">
        {entry.date}
      </div>
      <div className="col-start-2 row-start-1">
        <NoteBadge score={entry.score} />
      </div>
      {/* Positives · mot du jour · question, in the user-chosen lead order
          (`moodEntryLead`). Each block hangs behind an invisible bullet so its
          text lines up with the positives' text, not the bullet column; on
          mobile the bullet is hidden so everything stays flush-left. Blocks are
          built above; `space-y-1.5` gaps them regardless of which leads. */}
      <div className="col-span-2 row-start-2 min-w-0 space-y-1.5 md:col-span-1 md:col-start-3 md:row-start-1">
        {moodEntryOrder(lead).map((k) => blocks[k])}
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
