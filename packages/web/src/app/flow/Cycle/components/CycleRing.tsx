/**
 * Cycle ring (spec §6) — the glanceable « où j'en suis ». A donut with
 * the menstruation arc at the start and a marker at today's position ;
 * the centre reads « Jour N ». Degrades to just the day count when
 * there's no reliable cycle length yet (irregular / too little data).
 * Hand-rolled SVG, like `LabChart` / `ScoreDonut` — no chart lib.
 */
interface Props {
  day: number;
  length: number | null;
  periodLength: number;
  dayLabel: string;
  ofLabel: string | null;
}

const SIZE = 176;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const CENTER = SIZE / 2;

export default function CycleRing({ day, length, periodLength, dayLabel, ofLabel }: Props) {
  const periodFrac = length ? Math.min(periodLength / length, 1) : 0;
  const frac = length ? Math.min(day / length, 1) : 0;
  // Today's marker, 0 at the top of the ring going clockwise.
  const angle = frac * 2 * Math.PI - Math.PI / 2;
  const mx = CENTER + R * Math.cos(angle);
  const my = CENTER + R * Math.sin(angle);

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
        <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
          <circle
            cx={CENTER}
            cy={CENTER}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-bg-2"
          />
          {length ? (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={R}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${periodFrac * C} ${C}`}
              className="stroke-accent-strong"
            />
          ) : null}
        </g>
        {length ? (
          <circle cx={mx} cy={my} r={6} className="fill-accent stroke-bg" strokeWidth={3} />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-ink">{dayLabel}</span>
        {ofLabel ? <span className="text-[12px] text-muted">{ofLabel}</span> : null}
      </div>
    </div>
  );
}
