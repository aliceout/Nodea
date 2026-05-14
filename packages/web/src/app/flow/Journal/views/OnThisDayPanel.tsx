import { useMemo } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';

import { useJournalActions, useJournalData } from '../context';
import { pickOnThisDay, yearsAgo } from '../lib/on-this-day';
import type { JournalEntry } from '../lib/types';

/**
 * « Il y a un an » — issue #58, inspiration Day One.
 *
 * Surfaces past entries written on today's calendar day at the
 * top of the Journal. Aligned with the cadrage of the module : the
 * Journal isn't a productivity tracker, it's a temporal archive
 * you re-encounter. This panel turns « a wall of text I never re-
 * read » into « hey, look what you wrote a year ago today ».
 *
 * Returns `null` when there's nothing to show — no empty card, no
 * placeholder. The user only ever sees the panel on days when
 * past-them left a trail.
 *
 * Pure presentational : reads `entries` from data context, calls
 * `openReader` to navigate to the full reader on click. The
 * picking logic lives in `../lib/on-this-day.ts` so it stays
 * unit-testable without DOM.
 */
export default function OnThisDayPanel() {
  const { t } = useI18n();
  const { entries } = useJournalData();
  const { openReader } = useJournalActions();

  // `today` is captured once per render — fine since the Journal
  // route doesn't span a midnight tick in practice. If it ever
  // does (an open tab kept around the night through), the user
  // would see the same panel until they refresh ; acceptable trade
  // for not pulling a `useEffect`/interval here.
  const today = useMemo(() => new Date(), []);
  const memories = useMemo(
    () => pickOnThisDay(entries, today),
    [entries, today],
  );

  if (memories.length === 0) return null;

  return (
    <section
      className="mb-6 rounded-lg border border-hair bg-bg-2 px-4 py-3.5"
      aria-label={t('journal.onThisDay.aria', {
        defaultValue: 'Entrées d’années passées le même jour',
      })}
    >
      <header className="mb-2.5 flex items-baseline gap-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
          {t('journal.onThisDay.title', { defaultValue: 'Il y a quelques années' })}
        </h2>
        <span className="text-[11px] italic text-muted">
          {t('journal.onThisDay.subtitle', {
            defaultValue: 'Ce que tu as écrit le même jour, les années passées',
          })}
        </span>
      </header>

      <ul className="space-y-2.5">
        {memories.map((entry) => (
          <Memory key={entry.id} entry={entry} today={today} onOpen={openReader} />
        ))}
      </ul>
    </section>
  );
}

/* ---- Memory row -------------------------------------------------- */

interface MemoryProps {
  entry: JournalEntry;
  today: Date;
  onOpen: (id: string) => void;
}

function Memory({ entry, today, onOpen }: MemoryProps) {
  const { t, tn } = useI18n();
  const delta = yearsAgo(entry, today);
  const yearLabel =
    delta === 1
      ? t('journal.onThisDay.oneYearAgo', { defaultValue: 'Il y a un an' })
      : tn('journal.onThisDay.yearsAgo', delta, {
          values: { count: delta },
          defaultValue: 'Il y a {count} ans',
        });

  // Title fallback : the entry might be a free-form note without a
  // title — fall back on the first words of the content so the
  // memory still reads as a heading.
  const heading =
    entry.title?.trim() ||
    entry.content.trim().slice(0, 60).replace(/\s+\S*$/, '') ||
    t('journal.onThisDay.untitled', { defaultValue: 'Entrée sans titre' });

  // Preview : two lines of content (or whatever sits below the
  // title). Line-clamped via CSS so we don't fight the layout.
  const preview = entry.content.trim();

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(entry.id)}
        className="block w-full cursor-pointer rounded-md px-2 py-1.5 text-left transition-colors hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[13px] font-medium text-ink">
            {heading}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted">
            {yearLabel}
          </span>
        </div>
        {preview ? (
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.45] text-ink-soft">
            {preview}
          </p>
        ) : null}
      </button>
    </li>
  );
}
