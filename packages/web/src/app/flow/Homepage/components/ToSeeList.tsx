import { useMemo, useState } from 'react';

import { toIsoDate } from '@/core/i18n/date-format';
import { useNodeaStore } from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';

import { useHomepageData } from '../context';
import { MOCK_TASKS } from '../lib/constants';
import { formatTimeFromIso, signedScore } from '../lib/format';
import SectionLabel from './SectionLabel';

/** Rounded check icon used by both the dynamic Mood task and the
 *  mocked tasks below. Inline SVG to avoid pulling in another
 *  icon font for a single glyph. */
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
 * Mood task is dynamic : checked when the user has saved a Mood
 * entry today, with the time displayed on the right. The CTA
 * (« + Saisir ») opens the Composer pre-flagged for `mood` when
 * not yet saved.
 *
 * Mock tasks (Library + Habits) keep a small toggle so the
 * design still demos interactivity. Each row carries a stagger
 * delay so the list slides in cleanly.
 */
export default function ToSeeList() {
  const openComposer = useNodeaStore((s) => s.openComposer);
  const { mood } = useHomepageData();

  // Today's mood entry, if any. Same fetch powers the side-column
  // MoodBlock — both read from the lifted Homepage context.
  const todayMood = useMemo(() => {
    const todayIso = toIsoDate(new Date());
    return mood.find((e) => e.dateIso === todayIso) ?? null;
  }, [mood]);

  // Mock tasks keep a small toggle so the design still demos
  // interactivity. Mood task is derived, not toggled.
  const [mockChecked, setMockChecked] = useState<Record<number, boolean>>({});
  function toggleMock(index: number): void {
    setMockChecked((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  const moodMeta = todayMood
    ? `note ${signedScore(todayMood.score)}`
    : 'Pas encore saisi aujourd’hui';

  return (
    <div>
      <SectionLabel>À voir</SectionLabel>
      <ul className="-mt-px">
        {/* Mood task — dynamic */}
        <li
          className="animate-slide-in group flex items-baseline gap-3 border-b border-hair py-2.5"
          style={{ animationDelay: '0ms' }}
        >
          <span
            role="img"
            aria-label={todayMood ? 'Mood saisi' : 'Mood pas encore saisi'}
            className={cn(
              'flex h-4 w-4 shrink-0 translate-y-0.5 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200',
              todayMood ? 'border-accent bg-accent' : 'border-muted-soft',
            )}
          >
            {todayMood ? <CheckGlyph /> : null}
          </span>

          <div className="min-w-0 flex-1">
            <div
              className={cn(
                'text-[14.5px] font-medium transition-colors duration-200',
                todayMood ? 'text-muted line-through' : 'text-ink',
              )}
            >
              Mood du jour saisi
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted">{moodMeta}</div>
          </div>

          {todayMood ? (
            <span className="text-[11px] tabular-nums text-muted">
              {formatTimeFromIso(todayMood.createdAt)}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => openComposer('mood')}
              className="cursor-pointer rounded-md border border-hair bg-bg px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-accent hover:text-ink"
            >
              + Saisir
            </button>
          )}
        </li>

        {/* Mock tasks (Library + Habits not wired yet) */}
        {MOCK_TASKS.map((task, index) => {
          const isChecked = !!mockChecked[index];
          return (
            <li
              key={task.label}
              className="animate-slide-in group flex items-baseline gap-3 border-b border-hair py-2.5 last:border-b-0"
              style={{ animationDelay: `${(index + 1) * 80}ms` }}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                onClick={() => toggleMock(index)}
                className={cn(
                  'flex h-4 w-4 shrink-0 translate-y-0.5 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-[border-color,background,transform] duration-200',
                  isChecked
                    ? 'border-accent bg-accent'
                    : 'border-muted-soft hover:scale-110 hover:border-accent',
                )}
              >
                {isChecked ? <CheckGlyph /> : null}
              </button>

              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'text-[14.5px] font-medium transition-colors duration-200 group-hover:text-accent-deep',
                    isChecked ? 'text-muted line-through' : 'text-ink',
                  )}
                >
                  {task.label}
                </div>
                <div className="mt-0.5 text-[12.5px] text-muted">{task.meta}</div>
              </div>

              <span className="text-[11px] tabular-nums text-muted">
                {isChecked ? task.doneAt : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
