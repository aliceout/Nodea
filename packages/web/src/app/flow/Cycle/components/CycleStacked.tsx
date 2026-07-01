/**
 * Stacked-cycles view (spec §6) — the honest picture over time. One bar per
 * completed cycle (max 5, most recent). Each bar is captioned with its own
 * start date (left) and end date (right) — a cycle doesn't align to a month —
 * topped by a per-day tick ruler, and segmented by CYCLE PHASE : menstrual
 * (terracotta) · follicular · fertile (pale sage) · ovulation (sage diamond) ·
 * luteal. Phase boundaries come straight from the model (`ovulationDay`, with
 * O = length − 14). Pure CSS widths — no chart lib.
 */
import type { CycleSpan } from '../lib/cycle-model';
import { phaseSegments } from '../lib/cycle-model';

interface Props {
  cycles: readonly CycleSpan[];
  /** Anchor month (from the header selectors) : show the cycle active at that
   *  month + the four before it. */
  anchorY: number;
  anchorM: number; // 0-indexed
  language: string;
  emptyLabel: string;
  unit: (days: number) => string;
  periodLabel: string;
  fertileLabel: string;
  ovulationLabel: string;
}

const MAX_ROWS = 5; // the anchor cycle + the four before it (fits 300px, no scroll).
const DAY_MS = 86_400_000;

// Only the decision-carrying phases get a fill : period + the fertile window.
// Follicular + luteal are left as the bare track (little comparative signal).
const PHASE_BG: Record<'menstrual' | 'fertile', string> = {
  menstrual: 'bg-low',
  fertile: 'bg-accent-soft',
};

/** A cycle runs from its start (J1) to the day before the next period. */
function endIso(startIso: string, length: number): string {
  const [y, m, d] = startIso.split('-').map(Number);
  const t = Date.UTC(y!, m! - 1, d!, 12) + (length - 1) * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

export default function CycleStacked({
  cycles,
  anchorY,
  anchorM,
  language,
  emptyLabel,
  unit,
  periodLabel,
  fertileLabel,
  ovulationLabel,
}: Props) {
  // Show the cycle active at the anchor month + the four before it : keep the
  // completed cycles that started on or before the anchor month, most recent 5.
  const anchorKey = anchorY * 12 + anchorM;
  const completed = cycles
    .filter((c) => c.length != null)
    .filter((c) => {
      const cy = Number(c.start.slice(0, 4));
      const cm = Number(c.start.slice(5, 7)) - 1;
      return cy * 12 + cm <= anchorKey;
    })
    .slice(-MAX_ROWS)
    .reverse();
  if (completed.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyLabel}</p>;
  }
  const scale = Math.max(...completed.map((c) => c.length!));
  const pct = (days: number) => `${(days / scale) * 100}%`;
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(
      new Date(`${iso}T12:00:00`),
    );

  return (
    <div className="flex h-full flex-col px-1 py-2">
      <div className="flex flex-col gap-2.5">
        {completed.map((c) => {
          const segs = phaseSegments(c.length!, c.periodLength, c.ovulationDay);
          return (
            <div key={c.start} className="flex items-center gap-3 text-[12px]">
              <div className="flex-1">
                {/* start date at the bar's start, end date at its end */}
                <div className="relative mb-0.5 h-3 text-[10px] text-muted">
                  <span className="absolute left-0">{fmt(c.start)}</span>
                  <span
                    className="absolute -translate-x-full whitespace-nowrap"
                    style={{ left: pct(c.length!) }}
                  >
                    {fmt(endIso(c.start, c.length!))}
                  </span>
                </div>
                {/* per-day ruler above the bar ; taller + darker each week */}
                <div className="relative mb-0.5 h-2">
                  {Array.from({ length: scale }, (_, i) => i + 1).map((d) => (
                    <span
                      key={d}
                      className={`absolute bottom-0 w-px ${
                        d % 7 === 0 ? 'h-2 bg-muted' : 'h-1 bg-muted-soft'
                      }`}
                      style={{ left: pct(d) }}
                    />
                  ))}
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-bg-2">
                  {segs
                    .filter(
                      (s): s is { phase: 'menstrual' | 'fertile'; from: number; to: number } =>
                        s.phase === 'menstrual' || s.phase === 'fertile',
                    )
                    .map((s) => (
                      <div
                        key={s.phase}
                        className={`absolute inset-y-0 ${PHASE_BG[s.phase]}`}
                        style={{ left: pct(s.from - 1), width: pct(s.to - s.from + 1) }}
                      />
                    ))}
                  {c.ovulationDay != null && c.ovulationDay > c.periodLength ? (
                    <span
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-accent bg-bg"
                      style={{ left: pct(c.ovulationDay - 0.5) }}
                      title={`${ovulationLabel} · J${c.ovulationDay}`}
                    />
                  ) : null}
                </div>
              </div>
              <span
                className="w-16 shrink-0 text-right text-[11px] tabular-nums"
                title={`${periodLabel} ${c.periodLength} · ${unit(c.length!)}`}
              >
                <span className="font-semibold text-low">{c.periodLength}</span>
                <span className="text-muted-soft"> / {unit(c.length!)}</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hair pt-2 text-[11px] text-muted">
        <LegendSwatch swatch="bg-low" label={periodLabel} />
        <LegendSwatch swatch="bg-accent-soft" label={fertileLabel} />
        <LegendSwatch swatch="rounded-full border-[1.5px] border-accent" label={ovulationLabel} />
      </div>
    </div>
  );
}

function LegendSwatch({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 ${swatch.includes('rounded') ? '' : 'rounded-full'} ${swatch}`} />
      {label}
    </span>
  );
}
