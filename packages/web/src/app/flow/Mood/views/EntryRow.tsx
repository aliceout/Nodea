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
 *  the row only needs the entry as a prop. */
export default function EntryRow({ entry }: { entry: MoodEntry }) {
  const { t } = useI18n();
  const { editEntry, deleteEntry } = useMoodActions();

  return (
    <article className="group grid grid-cols-[110px_44px_1fr_auto] items-baseline gap-4 border-b border-hair py-4">
      <div className="text-[12px] tabular-nums text-muted">{entry.date}</div>
      <NoteBadge score={entry.score} />
      <div className="min-w-0">
        <ul className="space-y-0.5">
          {entry.positives
            .filter((p) => p.trim().length > 0)
            .map((p, i) => (
              <li
                key={i}
                className="flex items-baseline gap-2 text-[13px] leading-[1.5] text-ink"
              >
                <span aria-hidden="true" className="mt-0.5 text-[10px] text-muted">
                  ·
                </span>
                <span>{p}</span>
              </li>
            ))}
        </ul>
        {entry.comment ? (
          <p className="mt-1.5 text-[12px] italic leading-[1.5] text-ink-soft">
            {entry.comment}
          </p>
        ) : null}
        {entry.question ? (
          <div className="mt-1.5 text-[12px] text-muted">
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

      <HoverActions>
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
    </article>
  );
}
