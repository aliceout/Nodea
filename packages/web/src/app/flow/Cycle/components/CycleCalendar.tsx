/**
 * Cycle calendar — up to three months side by side, responsive : one
 * month on mobile, two at `md`, three at `lg` (the extra months are
 * `hidden` below their breakpoint, never stacked). Each month is a
 * compact grid : the date on top, a small flow droplet underneath
 * (never a big disc). Predicted next-period days show a hollow droplet ;
 * today sits in an accent pill. Every day is a focusable button (a11y)
 * that opens the day form. Weekday / month names come from `Intl`.
 */
import { useMemo } from 'react';
import type { CycleFlow } from '@nodea/shared';
import { cn } from '@/lib/utils';
import FlowMark from './FlowMark';

interface Props {
  flowByDate: ReadonlyMap<string, CycleFlow>;
  predictedDays: ReadonlySet<string>;
  today: string;
  selected: string | null;
  onSelectDay: (iso: string) => void;
  language: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function MonthGrid({
  y,
  m,
  flowByDate,
  predictedDays,
  today,
  selected,
  onSelectDay,
  language,
}: Props & { y: number; m: number }) {
  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(language, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(Date.UTC(2024, 0, 1 + i, 12))),
    );
  }, [language]);

  const monthLabel = new Intl.DateTimeFormat(language, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m, 1, 12)));
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const leading = (new Date(y, m, 1).getDay() + 6) % 7;

  return (
    <div className="w-[20rem] max-w-full">
      <div className="mb-2 text-center text-sm font-medium capitalize text-ink">{monthLabel}</div>
      <div className="grid grid-cols-7 gap-1">
        {weekdayNames.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] font-medium capitalize text-muted">
            {w}
          </div>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const iso = isoOf(y, m, day);
          const flow = flowByDate.get(iso);
          const isPredicted = !flow && predictedDays.has(iso);
          const isToday = iso === today;
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              aria-pressed={isSelected}
              aria-label={iso + (flow ? ` · règles (${flow})` : isPredicted ? ' · prédiction' : '')}
              className={cn(
                'flex h-11 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-input)]',
                'text-[13px] tabular-nums hover:bg-bg-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isSelected && 'ring-2 ring-accent',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full',
                  isToday ? 'bg-accent-soft font-semibold text-accent-deep' : 'text-ink',
                )}
              >
                {day}
              </span>
              <span className="flex h-2.5 items-center">
                <FlowMark {...(flow ? { flow } : { predicted: isPredicted })} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CycleCalendar(props: Props) {
  const [ty, tm] = props.today.split('-').map(Number);
  // Three consecutive months ending on the current month (rightmost, so
  // the past reads to its left). No nav here — the header year/month
  // selectors will drive the window.
  const months = [-2, -1, 0].map((i) => {
    const d = new Date(ty!, tm! - 1 + i, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    // Container query, not viewport : a month is dropped when the width
    // can't hold it, never wrapped ; the current month (rightmost) always
    // shows, past months appear to its left as width allows.
    <div className="@container">
      <div className="flex flex-nowrap justify-center gap-x-8">
        <div className="hidden shrink-0 @min-[1000px]:block">
          <MonthGrid {...props} y={months[0]!.y} m={months[0]!.m} />
        </div>
        <div className="hidden shrink-0 @min-[680px]:block">
          <MonthGrid {...props} y={months[1]!.y} m={months[1]!.m} />
        </div>
        <MonthGrid {...props} y={months[2]!.y} m={months[2]!.m} />
      </div>
    </div>
  );
}
