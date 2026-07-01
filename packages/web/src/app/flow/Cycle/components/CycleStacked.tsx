/**
 * Stacked-cycles view (spec §6) — the honest picture over time. One bar
 * per completed cycle, all aligned at day 1 and drawn against a shared
 * day axis (gridlines at 7/14/21/28…), so you can read *where* things
 * sit and how they drift : the « low »-coloured block is menstruation,
 * the track is the rest of the cycle, and the sage diamond is the
 * estimated ovulation (≈ next period − 14). Pure CSS widths — no chart
 * lib. Only completed cycles show (the ongoing one has no length yet).
 */
import type { CycleSpan } from '../lib/cycle-model';

interface Props {
  cycles: readonly CycleSpan[];
  language: string;
  emptyLabel: string;
  unit: (days: number) => string;
  periodLabel: string;
  ovulationLabel: string;
}

const LUTEAL = 14; // days from ovulation to the next period (estimate).
const TICKS = [7, 14, 21, 28, 35] as const;

export default function CycleStacked({
  cycles,
  language,
  emptyLabel,
  unit,
  periodLabel,
  ovulationLabel,
}: Props) {
  const completed = cycles.filter((c) => c.length != null).slice().reverse();
  if (completed.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyLabel}</p>;
  }
  const maxLen = Math.max(...completed.map((c) => c.length!));
  const scale = Math.max(35, maxLen);
  const ticks = TICKS.filter((tck) => tck <= scale);
  const pct = (days: number) => `${(days / scale) * 100}%`;

  return (
    <div>
      {/* Day axis */}
      <div className="mb-1 flex items-center gap-2">
        <span className="w-14 shrink-0" />
        <div className="relative h-3 flex-1">
          {ticks.map((tck) => (
            <span
              key={tck}
              className="absolute -translate-x-1/2 text-[10px] tabular-nums text-muted-soft"
              style={{ left: pct(tck) }}
            >
              {tck}
            </span>
          ))}
        </div>
        <span className="w-10 shrink-0" />
      </div>

      <div className="flex flex-col gap-2">
        {completed.map((c) => {
          const month = new Intl.DateTimeFormat(language, {
            month: 'short',
            year: '2-digit',
          }).format(new Date(`${c.start}T12:00:00`));
          const ovulation = c.length! - LUTEAL;
          return (
            <div key={c.start} className="flex items-center gap-2 text-[12px]">
              <span className="w-14 shrink-0 capitalize text-muted">{month}</span>
              <div className="relative h-4 flex-1">
                {ticks.map((tck) => (
                  <span
                    key={tck}
                    className="absolute inset-y-0 w-px bg-hair/60"
                    style={{ left: pct(tck) }}
                  />
                ))}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-bg-2"
                  style={{ width: pct(c.length!) }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-low"
                  style={{ width: pct(Math.min(c.periodLength, c.length!)) }}
                />
                {ovulation > c.periodLength ? (
                  <span
                    className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] bg-accent"
                    style={{ left: pct(ovulation) }}
                    title={ovulationLabel}
                  />
                ) : null}
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-muted">
                {unit(c.length!)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-low" />
          {periodLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rotate-45 rounded-[1px] bg-accent" />
          {ovulationLabel}
        </span>
      </div>
    </div>
  );
}
