/**
 * Cycle calendar — up to three months side by side, responsive : one month
 * on mobile, two at `md`, three at `lg` (extra months are `hidden` below
 * their breakpoint, never stacked). Each day is a compact, uncluttered cell :
 * the date on top (period days get a light-red disc, today an accent pill),
 * and a small mark underneath telling its CYCLE PHASE — a flow droplet
 * (logged period), a coloured dot (follicular / fertile / luteal) or a sage
 * diamond (estimated ovulation). Projected future days (this cycle's estimate)
 * fade their mark. Deliberately discreet — a dot, never a filled cell. Every
 * day is a focusable button (a11y) that opens the day form. Weekday / month
 * names come from `Intl`.
 */
import { useMemo } from 'react';
import type { CycleFlow } from '@nodea/shared';
import { cn } from '@/lib/utils';
import type { CyclePhase, DayPhase } from '../lib/cycle-model';
import FlowMark from './FlowMark';

interface Props {
  flowByDate: ReadonlyMap<string, CycleFlow>;
  phaseByDate: ReadonlyMap<string, DayPhase>;
  predictedDays: ReadonlySet<string>;
  today: string;
  /** Anchor (rightmost) month — the grid shows this month + the two before. */
  anchorY: number;
  anchorM: number; // 0-indexed
  selected: string | null;
  onSelectDay: (iso: string) => void;
  language: string;
}

// On the calendar we surface only period (flow droplet) and the estimated
// ovulation (a ring). The follicular / fertile / luteal stretches get no mark
// (they're still named on the hormone graph's phase band).
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** The small phase mark under the day number — droplet / dot / diamond. */
function DayMark({
  flow,
  phase,
  predicted,
  isPredictedPeriod,
}: {
  flow: CycleFlow | undefined;
  phase: CyclePhase | undefined;
  predicted: boolean;
  isPredictedPeriod: boolean;
}) {
  if (flow) return <FlowMark flow={flow} />;
  if (isPredictedPeriod) return <FlowMark predicted />;
  if (phase === 'ovulation') {
    // A hollow accent ring — distinct from the filled phase dots and the
    // teardrop droplet, without the diamond.
    return (
      <span
        className={cn(
          'h-2.5 w-2.5 rounded-full border-[1.5px] border-accent',
          predicted && 'opacity-60',
        )}
        aria-hidden="true"
      />
    );
  }
  return null;
}

function MonthGrid({
  y,
  m,
  flowByDate,
  phaseByDate,
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
      <div className="mb-2 truncate whitespace-nowrap text-center text-[13px] font-medium capitalize text-ink">
        {monthLabel}
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
          const iso = isoOf(y, m, day);
          const flow = flowByDate.get(iso);
          const dp = phaseByDate.get(iso);
          // Logged flow always reads as menstrual (its own droplet), whatever
          // the projection says ; the phase dot is for the non-period days.
          const phase: CyclePhase | undefined = flow ? undefined : dp?.phase;
          const phasePredicted = !flow && (dp?.predicted ?? false);
          const isPredictedPeriod = !flow && predictedDays.has(iso);
          const isPeriod = flow !== undefined;
          const isToday = iso === today;
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              aria-pressed={isSelected}
              aria-label={
                iso +
                (flow
                  ? ` · règles (${flow})`
                  : dp?.phase
                    ? ` · phase ${dp.phase}${phasePredicted ? ' (estimée)' : ''}`
                    : isPredictedPeriod
                      ? ' · prédiction'
                      : '')
              }
              className={cn(
                'flex h-9 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-input)]',
                'text-[12px] tabular-nums hover:bg-bg-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isSelected && 'ring-2 ring-accent',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full',
                  isPeriod
                    ? 'bg-low-soft font-medium text-low-deep'
                    : isToday
                      ? 'bg-accent-soft font-semibold text-accent-deep'
                      : 'text-ink',
                  isPeriod && isToday && 'ring-1 ring-accent',
                )}
              >
                {day}
              </span>
              <span className="flex h-2.5 items-center">
                <DayMark
                  flow={flow}
                  phase={phase}
                  predicted={phasePredicted}
                  isPredictedPeriod={isPredictedPeriod}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CycleCalendar(props: Props) {
  // Three consecutive months ending on the anchor (rightmost, so the past
  // reads to its left). The anchor is computed by CycleViews from the header
  // year / month selectors.
  const months = [-2, -1, 0].map((i) => {
    const d = new Date(props.anchorY, props.anchorM + i, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    // Container query, not viewport : a month is dropped when the width can't
    // hold it, never wrapped ; the current month (rightmost) always shows.
    <div className="@container">
      <div className="flex flex-nowrap justify-evenly">
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
