/**
 * Cycle calendar — one month at a time with prev/next nav.
 *
 * The « maison » view (spec §6). A compact fixed-size grid (capped
 * width so cells stay small on a wide column) : the date number on top,
 * a small flow droplet underneath — never a big filled disc. Predicted
 * next-period days show a hollow droplet ; today's number sits in an
 * accent pill. Every day is a focusable button (a11y baseline) that
 * opens the day form. Weekday / month names come from `Intl` — no i18n
 * keys to maintain.
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

export default function CycleCalendar({
  flowByDate,
  predictedDays,
  today,
  selected,
  onSelectDay,
  language,
}: Props) {
  const [view, setView] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { y: y!, m: m! - 1 };
  });

  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(language, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(Date.UTC(2024, 0, 1 + i, 12))),
    );
  }, [language]);

  const monthLabel = new Intl.DateTimeFormat(language, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(view.y, view.m, 1, 12)));

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const leading = (new Date(view.y, view.m, 1).getDay() + 6) % 7;

  const shift = (delta: number) =>
    setView((v) => {
      const next = new Date(v.y, v.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });

  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="sm" iconOnly onClick={() => shift(-1)} aria-label={monthLabel}>
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize text-ink">{monthLabel}</span>
        <Button variant="ghost" size="sm" iconOnly onClick={() => shift(1)} aria-label={monthLabel}>
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>

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
          const iso = isoOf(view.y, view.m, day);
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
