/**
 * Cycle calendar — one month at a time with prev/next nav.
 *
 * The « maison » view (spec §6). Period days are filled, the predicted
 * next-period band is a dashed outline, today gets a ring. Every day is
 * a focusable button (a11y — this app's baseline) that opens the day
 * form. ponytail: single month + arrows rather than a scrolling multi-
 * month grid — the 80% at a fraction of the code ; widen later if asked.
 * Weekday / month names come from `Intl`, so no i18n keys to maintain.
 */
import { useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import Button from '@/ui/atoms/dirk/Button';
import { cn } from '@/lib/utils';

interface Props {
  periodDays: ReadonlySet<string>;
  predictedDays: ReadonlySet<string>;
  today: string;
  selected: string | null;
  onSelectDay: (iso: string) => void;
  language: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function CycleCalendar({
  periodDays,
  predictedDays,
  today,
  selected,
  onSelectDay,
  language,
}: Props) {
  const [view, setView] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { y: y!, m: m! - 1 }; // m is 0-indexed
  });

  const weekdayNames = useMemo(() => {
    // Build Mon→Sun short names from a known Monday (2024-01-01).
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
  // Monday-first offset for the 1st of the month.
  const leading = (new Date(view.y, view.m, 1).getDay() + 6) % 7;

  const shift = (delta: number) =>
    setView((v) => {
      const next = new Date(v.y, v.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="sm" iconOnly onClick={() => shift(-1)} aria-label={monthLabel}>
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize text-ink">{monthLabel}</span>
        <Button variant="ghost" size="sm" iconOnly onClick={() => shift(1)} aria-label={monthLabel}>
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdayNames.map((w) => (
          <div key={w} className="pb-1 text-[11px] font-medium capitalize text-muted">
            {w}
          </div>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const iso = isoOf(view.y, view.m, day);
          const isPeriod = periodDays.has(iso);
          const isPredicted = !isPeriod && predictedDays.has(iso);
          const isToday = iso === today;
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              aria-pressed={isSelected}
              aria-label={iso + (isPeriod ? ' · règles' : isPredicted ? ' · prédiction' : '')}
              className={cn(
                'flex aspect-square items-center justify-center rounded-full text-[13px] tabular-nums',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isPeriod && 'bg-accent-strong font-medium text-white',
                isPredicted && 'border border-dashed border-accent text-accent',
                !isPeriod && !isPredicted && 'text-ink hover:bg-bg-2',
                isToday && !isPeriod && 'ring-1 ring-accent',
                isSelected && 'ring-2 ring-accent',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
