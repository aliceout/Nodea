import { useMemo } from 'react';

import { toIsoDate } from '@/core/i18n/date-format';
import { useNodeaStore } from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';

import { useHomepageData } from '../context';
import { formatTimeFromIso, signedScore } from '../lib/format';
import SectionLabel from './SectionLabel';

/** Rounded check icon used by the dynamic « À voir » rows. Inline
 *  SVG to avoid pulling in another icon font for a single glyph. */
function CheckGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 6.5l3 3 5-7"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * « À voir » list at the top of the Home primary column.
 *
 * Two dynamic rows :
 *  - Mood task — checked when today's mood entry is saved, CTA
 *    (« + Saisir ») opens the Composer pre-flagged for `mood`.
 *  - Journal task — checked when at least one entry was written
 *    today, CTA (« + Écrire ») opens the Composer for `journal`.
 *
 * The earlier static Library / Habits mocks were dropped — Habits
 * is intentionally off (module not built yet), Library has its own
 * « En cours de lecture » block below.
 */
export default function ToSeeList() {
  const openComposer = useNodeaStore((s) => s.openComposer);
  const { mood, journal } = useHomepageData();

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const todayMood = useMemo(
    () => mood.find((e) => e.dateIso === todayIso) ?? null,
    [mood, todayIso],
  );
  const todayJournal = useMemo(
    () => journal.find((e) => e.dateIso === todayIso) ?? null,
    [journal, todayIso],
  );

  const moodMeta = todayMood
    ? `note ${signedScore(todayMood.score)}`
    : 'Pas encore saisi aujourd’hui';
  const journalMeta = todayJournal
    ? journalSnippet(todayJournal.title, todayJournal.content)
    : 'Pas encore écrit aujourd’hui';

  return (
    <div>
      <SectionLabel>À voir</SectionLabel>
      <ul className="-mt-px">
        <Row
          index={0}
          label="Mood du jour saisi"
          meta={moodMeta}
          checked={todayMood !== null}
          checkedAt={todayMood ? formatTimeFromIso(todayMood.createdAt) : null}
          onAct={() => openComposer('mood')}
          actLabel="+ Saisir"
        />
        <Row
          index={1}
          label="Entrée Journal du jour"
          meta={journalMeta}
          checked={todayJournal !== null}
          checkedAt={null}
          onAct={() => openComposer('journal')}
          actLabel="+ Écrire"
          isLast
        />
      </ul>
    </div>
  );
}

/** One line in the « À voir » list. Same visual rhythm whether the
 *  task is done (faded + line-through + time on the right) or
 *  pending (live label + action CTA on the right). The stagger
 *  delay keeps the slide-in animation in sequence. */
function Row({
  index,
  label,
  meta,
  checked,
  checkedAt,
  onAct,
  actLabel,
  isLast,
}: {
  index: number;
  label: string;
  meta: string;
  checked: boolean;
  checkedAt: string | null;
  onAct: () => void;
  actLabel: string;
  isLast?: boolean;
}) {
  return (
    <li
      className={cn(
        'animate-slide-in group flex items-baseline gap-3 border-b border-hair py-2.5',
        isLast && 'last:border-b-0',
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <span
        role="img"
        aria-label={checked ? `${label} — fait` : `${label} — à faire`}
        className={cn(
          'flex h-4 w-4 shrink-0 translate-y-0.5 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200',
          checked ? 'border-accent bg-accent' : 'border-muted-soft',
        )}
      >
        {checked ? <CheckGlyph /> : null}
      </span>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'text-[14.5px] font-medium transition-colors duration-200',
            checked ? 'text-muted line-through' : 'text-ink',
          )}
        >
          {label}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-muted">{meta}</div>
      </div>

      {checked ? (
        checkedAt ? (
          <span className="text-[11px] tabular-nums text-muted">{checkedAt}</span>
        ) : null
      ) : (
        <button
          type="button"
          onClick={onAct}
          className="cursor-pointer rounded-md border border-hair bg-bg px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-accent hover:text-ink"
        >
          {actLabel}
        </button>
      )}
    </li>
  );
}

/** Short « meta » text for a written Journal entry — the title if
 *  set, otherwise the first 8 words of the content trimmed. Keeps
 *  the list compact. */
function journalSnippet(title: string | null, content: string): string {
  if (title && title.trim().length > 0) return title.trim();
  const words = content.trim().split(/\s+/).slice(0, 8).join(' ');
  return words.length > 0 ? `« ${words}… »` : 'Entrée écrite';
}
