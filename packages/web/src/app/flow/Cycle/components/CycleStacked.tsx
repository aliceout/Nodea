/**
 * Stacked-cycles view (spec §6) — the honest picture over time. One bar
 * per completed cycle (max 6, most recent), aligned at day 1 against a
 * shared day axis (per-day ticks, week numbers 7 / 14 / 21…) so the red
 * menstruation block reads « ≈ N days » at a glance. Each bar is
 * captioned with its own start → end dates (a cycle doesn't align to a
 * month) on the line above it. The sage diamond is the estimated
 * ovulation (≈ next period − 14). Pure CSS widths — no chart lib.
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
const MAX_ROWS = 6; // « max 6 mois » — the 6 most recent completed cycles.
const DAY_MS = 86_400_000;

/** A cycle runs from its start (J1) to the day before the next period. */
function endIso(startIso: string, length: number): string {
  const [y, m, d] = startIso.split('-').map(Number);
  const t = Date.UTC(y!, m! - 1, d!, 12) + (length - 1) * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

export default function CycleStacked({
  cycles,
  language,
  emptyLabel,
  unit,
  periodLabel,
  ovulationLabel,
}: Props) {
  const completed = cycles.filter((c) => c.length != null).slice(-MAX_ROWS).reverse();
  if (completed.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyLabel}</p>;
  }
  const maxLen = Math.max(...completed.map((c) => c.length!));
  const scale = Math.max(35, maxLen);
  const ticks = TICKS.filter((tck) => tck <= scale);
  const pct = (days: number) => `${(days / scale) * 100}%`;
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(
      new Date(`${iso}T12:00:00`),
    );

  return (
    <div className="px-1 py-2">
      {/* Day axis — a per-day ruler ; every day is a tick, taller +
          numbered at each week (7 / 14 / 21…). */}
      <div className="mb-2 flex items-end gap-3">
        <div className="relative h-5 flex-1">
          {Array.from({ length: scale }, (_, i) => i + 1).map((d) => (
            <span
              key={d}
              className={`absolute bottom-0 w-px ${
                d % 7 === 0 ? 'h-2.5 bg-hair' : 'h-1.5 bg-hair/50'
              }`}
              style={{ left: pct(d) }}
            />
          ))}
          {ticks.map((tck) => (
            <span
              key={tck}
              className="absolute top-0 -translate-x-1/2 text-[10px] tabular-nums text-muted"
              style={{ left: pct(tck) }}
            >
              {tck}
            </span>
          ))}
        </div>
        <span className="w-16 shrink-0" />
      </div>

      <div className="flex flex-col gap-4">
        {completed.map((c) => {
          const ovulation = c.length! - LUTEAL;
          return (
            <div key={c.start}>
              {/* A cycle doesn't align to a month — caption it with its
                  own span dates, on the line above the bar. */}
              <div className="mb-1 text-[10px] text-muted">
                {fmt(c.start)} → {fmt(endIso(c.start, c.length!))}
              </div>
              <div className="flex items-center gap-3 text-[12px]">
                <div className="relative h-5 flex-1">
                  {ticks.map((tck) => (
                    <span
                      key={tck}
                      className="absolute inset-y-0 w-px bg-hair"
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
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] bg-accent ring-2 ring-bg"
                      style={{ left: pct(ovulation) }}
                      title={`${ovulationLabel} · J${ovulation}`}
                    />
                  ) : null}
                </div>
                <span
                  className="w-16 shrink-0 text-right text-[11px] tabular-nums"
                  title={`${periodLabel} ${c.periodLength} · ${unit(c.length!)}`}
                >
                  <span className="font-semibold text-low">{c.periodLength}</span>
                  <span className="text-muted-soft"> / {unit(c.length!)}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend — given room to breathe below the bars. */}
      <div className="mt-6 flex items-center gap-4 border-t border-hair pt-3 text-[11px] text-muted">
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
