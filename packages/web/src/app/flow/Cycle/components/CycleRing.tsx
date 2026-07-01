/**
 * Cycle ring (spec §6) — « où j'en suis », Clue-inspired. A large donut
 * that fills the graph frame's height : the menstruation arc at the
 * start (« low » = period), an elapsed arc (pale sage, day 1 → today),
 * a per-day tick ruler, an ovulation diamond (sage), and the current
 * day as a pill on the ring. The centre carries the useful read (date,
 * next-period line, fertility hint) ; the recap (period length, est.
 * ovulation, « J1 = … ») sits to the LEFT so it doesn't eat vertical
 * space. Hand-rolled SVG, like `LabChart` — no chart lib.
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

const SIZE = 300;
const STROKE = 18;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const CENTER = SIZE / 2;
const FERTILE_BEFORE = 5;
const FERTILE_AFTER = 1;

function pointAt(frac: number, r: number = R): { x: number; y: number } {
  const a = frac * 2 * Math.PI - Math.PI / 2;
  return { x: CENTER + r * Math.cos(a), y: CENTER + r * Math.sin(a) };
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

  const primary =
    periodLength > 0 && day <= periodLength
      ? t('cycle.ring.periodDay', { values: { count: day } })
      : next && next.daysUntil > 0
        ? t('cycle.ring.periodsIn', { values: { count: next.daysUntil } })
        : next
          ? t('cycle.ring.periodsToday')
          : t('cycle.ring.day', { values: { count: day } });

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
    <div className="flex flex-col items-center gap-6 py-2 sm:flex-row sm:justify-center sm:gap-12">
      {/* Recap — right of the ring on sm+ so it doesn't add height. */}
      <div className="order-2 space-y-1.5 text-center text-[13px] text-muted sm:order-2 sm:max-w-[170px] sm:text-left">
        <p>
          <span className="font-medium text-low">{t('cycle.legend.period')}</span> ·{' '}
          {t('cycle.stacked.unit', { values: { count: periodLength } })}
        </p>
        {ovulation ? (
          <p>
            <span className="font-medium text-accent">{t('cycle.stacked.ovulation')}</span> ·
            {' ~J'}
            {ovulation.day} · {fmtDate(ovulation.date)}
          </p>
        ) : null}
        <p className="text-[11px] text-muted-soft">{t('cycle.ring.j1hint')}</p>
      </div>

      <div
        className="relative order-1 shrink-0 sm:order-1"
        style={{ width: SIZE, height: SIZE }}
      >
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
          {/* One tick per cycle day just inside the band ; longer +
              darker at each week so every day is materialised. */}
          {length
            ? Array.from({ length }, (_, d) => {
                const major = d % 7 === 0;
                const outer = pointAt(d / length, R - STROKE / 2);
                const inner = pointAt(d / length, R - STROKE / 2 - (major ? 7 : 4));
                return (
                  <line
                    key={d}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    className={major ? 'stroke-muted' : 'stroke-muted-soft'}
                    strokeWidth={major ? 1.25 : 0.75}
                  />
                );
              })
            : null}
          {ovPoint ? (
            <rect
              x={ovPoint.x - 5}
              y={ovPoint.y - 5}
              width={10}
              height={10}
              transform={`rotate(45 ${ovPoint.x} ${ovPoint.y})`}
              className="fill-accent stroke-bg"
              strokeWidth={2}
            />
          ) : null}
        </svg>

        {today ? (
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg px-2 py-0.5 text-[12px] font-semibold text-ink shadow-sm ring-1 ring-hair"
            style={{ left: today.x, top: today.y }}
          >
            {t('cycle.ring.dayBadge', { values: { count: day } })}
          </span>
        ) : null}

        <div className="absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
          <span className="text-[12px] text-muted">
            {t('cycle.ring.todayLabel', { values: { date: fmtDate(todayIso) } })}
          </span>
          <span className="mt-0.5 text-[18px] font-semibold leading-tight text-ink">
            {primary}
          </span>
          {fertileHint ? (
            <span className="mt-1 text-[12px] text-accent">{fertileHint}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
