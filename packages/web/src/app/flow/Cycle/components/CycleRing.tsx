/**
 * Cycle ring (spec §6) — « où j'en suis », Clue-inspired. A donut with
 * the menstruation arc at the start (« low » = period), an elapsed arc
 * (pale sage, day 1 → today), an ovulation diamond (sage), and the
 * current day as a pill on the ring at today's position. The centre
 * carries the useful read : today's date, a natural-language next-
 * period line, and a fertility hint. Explicit « J1 = 1er jour des
 * règles ». Hand-rolled SVG, like `LabChart` — no chart lib.
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';

interface Props {
  day: number;
  length: number | null;
  periodLength: number;
  ovulation: { day: number; date: string } | null;
  next: { date: string; daysUntil: number } | null;
  todayIso: string;
}

const SIZE = 176;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const CENTER = SIZE / 2;
/** Fertile window around ovulation : 5 days before → 1 day after. */
const FERTILE_BEFORE = 5;
const FERTILE_AFTER = 1;

function pointAt(frac: number): { x: number; y: number } {
  const a = frac * 2 * Math.PI - Math.PI / 2;
  return { x: CENTER + R * Math.cos(a), y: CENTER + R * Math.sin(a) };
}

export default function CycleRing({
  day,
  length,
  periodLength,
  ovulation,
  next,
  todayIso,
}: Props) {
  const { t, language } = useI18n();
  const periodFrac = length ? Math.min(periodLength / length, 1) : 0;
  const elapsedFrac = length ? Math.min(day / length, 1) : 0;
  const today = length ? pointAt(elapsedFrac) : null;
  const ovPoint = length && ovulation ? pointAt(ovulation.day / length) : null;

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(
      new Date(`${iso}T12:00:00`),
    );

  // Primary line : in period → « Jour N des règles » ; else the
  // next-period countdown.
  const primary =
    periodLength > 0 && day <= periodLength
      ? t('cycle.ring.periodDay', { values: { count: day } })
      : next && next.daysUntil > 0
        ? t('cycle.ring.periodsIn', { values: { count: next.daysUntil } })
        : next
          ? t('cycle.ring.periodsToday')
          : t('cycle.ring.day', { values: { count: day } });

  // Fertility hint : inside the window → « jour fertile » ; before it →
  // the estimated ovulation date ; after → nothing.
  const inFertile =
    ovulation &&
    day >= ovulation.day - FERTILE_BEFORE &&
    day <= ovulation.day + FERTILE_AFTER;
  const fertileHint = inFertile
    ? t('cycle.ring.fertile')
    : ovulation && day < ovulation.day
      ? t('cycle.ring.ovOn', { values: { date: fmtDate(ovulation.date) } })
      : null;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            <circle cx={CENTER} cy={CENTER} r={R} fill="none" strokeWidth={STROKE} className="stroke-bg-2" />
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
        </svg>

        {/* Day pill on the ring at today's position (Clue-style). */}
        {today ? (
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg px-1.5 py-0.5 text-[11px] font-semibold text-ink shadow-sm ring-1 ring-hair"
            style={{ left: today.x, top: today.y }}
          >
            {t('cycle.ring.dayBadge', { values: { count: day } })}
          </span>
        ) : null}

        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <span className="text-[11px] text-muted">
            {t('cycle.ring.todayLabel', { values: { date: fmtDate(todayIso) } })}
          </span>
          <span className="mt-0.5 text-[15px] font-semibold leading-tight text-ink">
            {primary}
          </span>
          {fertileHint ? (
            <span className="mt-0.5 text-[11px] text-accent">{fertileHint}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-1 text-center text-[12px] text-muted">
        <p>
          <span className="font-medium text-low">{t('cycle.legend.period')}</span> ·{' '}
          {t('cycle.stacked.unit', { values: { count: periodLength } })}
        </p>
        <p className="text-[11px] text-muted-soft">{t('cycle.ring.j1hint')}</p>
      </div>
    </div>
  );
}
