/**
 * Cycle calendar — up to three months side by side, responsive : one
 * month on mobile, two at `md`, three at `lg` (the extra months are
 * `hidden` below their breakpoint, never stacked). Each month is a
 * compact grid : the date on top, a small flow droplet underneath
 * (never a big disc). Predicted next-period days show a hollow droplet ;
 * today sits in an accent pill. Every day is a focusable button (a11y)
 * that opens the day form. Weekday / month names come from `Intl`.
 */
import { useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { CycleFlow } from '@nodea/shared';
import Button from '@/ui/atoms/dirk/Button';
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
  const [anchor, setAnchor] = useState(() => {
    const [y, m] = props.today.split('-').map(Number);
    return { y: y!, m: m! - 1 };
  });

  const shift = (delta: number) =>
    setAnchor((a) => {
      const next = new Date(a.y, a.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });

  // Three consecutive months from the anchor ; the 2nd/3rd only show at
  // md/lg via `hidden`, so a narrow column keeps a single month.
  const months = [0, 1, 2].map((i) => {
    const d = new Date(anchor.y, anchor.m + i, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-center gap-6">
        <Button variant="ghost" size="sm" iconOnly onClick={() => shift(-1)} aria-label="←">
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" iconOnly onClick={() => shift(1)} aria-label="→">
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap justify-center gap-x-10 gap-y-6">
        <MonthGrid {...props} y={months[0]!.y} m={months[0]!.m} />
        <div className="hidden md:block">
          <MonthGrid {...props} y={months[1]!.y} m={months[1]!.m} />
        </div>
        <div className="hidden lg:block">
          <MonthGrid {...props} y={months[2]!.y} m={months[2]!.m} />
        </div>
      </div>
    </div>
  );
}
