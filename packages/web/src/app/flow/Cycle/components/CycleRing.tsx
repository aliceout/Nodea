/**
 * Cycle ring (spec §6) — « où j'en suis », Clue-inspired. Menstruation
 * arc at the start (« low » = period), an elapsed arc (pale sage, day 1
 * → today), a per-day tick ruler with week labels (7 / 14 / 21…), an
 * ovulation diamond (sage), and the current day as a pill on the ring.
 * The scale ADAPTS : if today runs past the estimated length the ring
 * extends to today. The centre shows the date + next-period read ; the
 * recap sits beside it (or below, when `stacked` — e.g. in the sidebar).
 * `size` drives the geometry so it fits both a wide frame and a 280 px
 * column. Hand-rolled SVG, like `LabChart` — no chart lib.
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

interface Props {
  day: number;
  length: number | null;
  periodLength: number;
  ovulation: { day: number; date: string } | null;
  next: { date: string; daysUntil: number } | null;
  todayIso: string;
  /** Ring diameter in px (default 300). */
  size?: number;
  /** Force the recap below the ring instead of beside it (sidebar). */
  stacked?: boolean;
}

const FERTILE_BEFORE = 5;
const FERTILE_AFTER = 1;
const WEEK_MARKS = [7, 14, 21, 28, 35, 42] as const;

export default function CycleRing({
  day,
  length,
  periodLength,
  ovulation,
  next,
  todayIso,
  size = 300,
  stacked = false,
}: Props) {
  const { t, language } = useI18n();

  const stroke = Math.max(12, Math.round(size * 0.06));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  const pointAt = (frac: number, radius: number = r) => {
    const a = frac * 2 * Math.PI - Math.PI / 2;
    return { x: center + radius * Math.cos(a), y: center + radius * Math.sin(a) };
  };

  // Ring total ADAPTS : never shorter than today, so an overdue cycle
  // extends instead of pinning the marker at the top.
  const total = length ? Math.max(length, day) : null;
  const periodFrac = total ? Math.min(periodLength / total, 1) : 0;
  const elapsedFrac = total ? Math.min(day / total, 1) : 0;
  const today = total ? pointAt(elapsedFrac) : null;
  const ovPoint = total && ovulation ? pointAt(ovulation.day / total) : null;

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

  const big = size >= 260;
  const padX = Math.round(size * 0.12);

  return (
    <div
      className={cn(
        'flex flex-col items-center',
        stacked ? 'gap-3' : 'gap-6 py-2 sm:flex-row sm:justify-center sm:gap-12',
      )}
    >
      <div
        className={cn('relative shrink-0', stacked ? '' : 'order-1')}
        style={{ width: size, height: size }}
      >
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
          <g transform={`rotate(-90 ${center} ${center})`}>
            <circle cx={center} cy={center} r={r} fill="none" strokeWidth={stroke} className="stroke-bg-2" />
            {total ? (
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                strokeWidth={stroke}
                strokeDasharray={`${elapsedFrac * c} ${c}`}
                className="stroke-accent-soft"
              />
            ) : null}
            {total ? (
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                strokeWidth={stroke}
                strokeDasharray={`${periodFrac * c} ${c}`}
                className="stroke-low"
              />
            ) : null}
          </g>
          {total
            ? Array.from({ length: total }, (_, d) => {
                const major = d % 7 === 0;
                const outer = pointAt(d / total, r - stroke / 2);
                const inner = pointAt(d / total, r - stroke / 2 - (major ? 7 : 4));
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
          {total
            ? WEEK_MARKS.filter((w) => w < total).map((w) => {
                const p = pointAt(w / total, r - stroke / 2 - 15);
                return (
                  <text
                    key={w}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-muted"
                    fontSize={big ? 10 : 8}
                  >
                    {w}
                  </text>
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
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm ring-1 ring-hair"
            style={{ left: today.x, top: today.y }}
          >
            {t('cycle.ring.dayBadge', { values: { count: day } })}
          </span>
        ) : null}

        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center"
          style={{ paddingLeft: padX, paddingRight: padX }}
        >
          <span className="text-[11px] text-muted">
            {t('cycle.ring.todayLabel', { values: { date: fmtDate(todayIso) } })}
          </span>
          <span
            className={cn('mt-0.5 font-semibold leading-tight text-ink', big ? 'text-[18px]' : 'text-[14px]')}
          >
            {primary}
          </span>
        </div>
      </div>

      <div
        className={cn(
          'space-y-1.5 text-center text-[13px] text-muted',
          stacked ? '' : 'order-2 sm:text-left',
        )}
      >
        <p>
          <span className="font-medium text-low">{t('cycle.legend.period')}</span> ·{' '}
          {t('cycle.stacked.unit', { values: { count: periodLength } })}
        </p>
        {ovulation ? (
          inFertile ? (
            <p>
              <span className="font-medium text-accent">{t('cycle.ring.fertile')}</span> ·{' '}
              {fmtDate(ovulation.date)}
            </p>
          ) : (
            <p>
              <span className="font-medium text-accent">{t('cycle.stacked.ovulation')}</span> ·{' '}
              ~J{ovulation.day} · {fmtDate(ovulation.date)}
            </p>
          )
        ) : null}
        <p className="text-[11px] text-muted-soft">{t('cycle.ring.j1hint')}</p>
      </div>
    </div>
  );
}
