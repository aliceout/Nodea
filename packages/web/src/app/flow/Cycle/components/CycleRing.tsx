/**
 * Cycle ring (spec §6) — the glanceable « où j'en suis ». A donut with
 * the menstruation arc at the start (« low » = period), an estimated-
 * ovulation diamond (sage, ≈ next period − 14), and a marker at today.
 * Below it : period length, the ovulation estimate, and an explicit
 * « J1 = 1er jour des règles » so the start-on-period convention reads
 * as intent, not a bug. Degrades to a plain day count when there's no
 * reliable length yet. Hand-rolled SVG, like `LabChart` — no chart lib.
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';

interface Props {
  day: number;
  length: number | null;
  periodLength: number;
  ovulation: { day: number; date: string } | null;
}

const SIZE = 176;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const CENTER = SIZE / 2;

/** Point on the ring for a cycle day, 0 at the top going clockwise. */
function pointAt(frac: number): { x: number; y: number } {
  const a = frac * 2 * Math.PI - Math.PI / 2;
  return { x: CENTER + R * Math.cos(a), y: CENTER + R * Math.sin(a) };
}

export default function CycleRing({ day, length, periodLength, ovulation }: Props) {
  const { t, language } = useI18n();
  const periodFrac = length ? Math.min(periodLength / length, 1) : 0;
  const elapsedFrac = length ? Math.min(day / length, 1) : 0;
  const today = length ? pointAt(elapsedFrac) : null;
  const ovPoint = length && ovulation ? pointAt(ovulation.day / length) : null;
  const ovDateLabel =
    ovulation &&
    new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long' }).format(
      new Date(`${ovulation.date}T12:00:00`),
    );

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            <circle cx={CENTER} cy={CENTER} r={R} fill="none" strokeWidth={STROKE} className="stroke-bg-2" />
            {/* Elapsed since day 1 → today : the cycle « fills up ». */}
            {length ? (
              <circle
                cx={CENTER}
                cy={CENTER}
                r={R}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={`${elapsedFrac * C} ${C}`}
                className="stroke-accent-soft"
              />
            ) : null}
            {/* Menstruation, drawn on top of the elapsed arc at the start. */}
            {length ? (
              <circle
                cx={CENTER}
                cy={CENTER}
                r={R}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={`${periodFrac * C} ${C}`}
                className="stroke-low"
              />
            ) : null}
          </g>
          {ovPoint ? (
            <rect
              x={ovPoint.x - 4}
              y={ovPoint.y - 4}
              width={8}
              height={8}
              transform={`rotate(45 ${ovPoint.x} ${ovPoint.y})`}
              className="fill-accent stroke-bg"
              strokeWidth={2}
            />
          ) : null}
          {today ? (
            <circle cx={today.x} cy={today.y} r={5} className="fill-ink stroke-bg" strokeWidth={2} />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-ink">
            {t('cycle.ring.day', { values: { count: day } })}
          </span>
          {length ? (
            <span className="text-[12px] text-muted">
              {t('cycle.ring.of', { values: { length } })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-1 text-center text-[12px] text-muted">
        <p>
          <span className="font-medium text-low">{t('cycle.legend.period')}</span> ·{' '}
          {t('cycle.stacked.unit', { values: { count: periodLength } })}
        </p>
        {ovulation ? (
          <p>
            <span className="font-medium text-accent">{t('cycle.stacked.ovulation')}</span> ·{' '}
            {t('cycle.ring.ovulation', {
              values: { day: ovulation.day, date: ovDateLabel },
            })}
          </p>
        ) : null}
        <p className="text-[11px] text-muted-soft">{t('cycle.ring.j1hint')}</p>
      </div>
    </div>
  );
}
