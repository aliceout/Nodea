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
  /** Day-1 date of the current cycle (top of the ring). */
  startIso: string;
  todayIso: string;
  /** Prefix the next-period read with « ~ » — the estimate is looser than
   *  usual (few cycles, or a clamped ovulation). */
  approximate?: boolean;
  /** Ring diameter in px (default 300). */
  size?: number;
}

const WEEK_MARKS = [7, 14, 21, 28, 35, 42] as const;

export default function CycleRing({
  day,
  length,
  periodLength,
  ovulation,
  next,
  startIso,
  todayIso,
  approximate = false,
  size = 300,
}: Props) {
  const { t, language } = useI18n();
  const approx = approximate ? '~' : '';
  const addDays = (iso: string, n: number) => {
    const [yy, mm, dd] = iso.split('-').map(Number);
    return new Date(Date.UTC(yy!, mm! - 1, dd!, 12) + n * 86_400_000)
      .toISOString()
      .slice(0, 10);
  };

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
  // Date anchors OUTSIDE the ring : day 1 at the top (12 o'clock), the
  // mid-cycle date at the bottom (6 o'clock = half a turn = day total/2).
  const midDate = total ? addDays(startIso, Math.round(total / 2) - 1) : null;

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(
      new Date(`${iso}T12:00:00`),
    );

  const primary =
    periodLength > 0 && day <= periodLength
      ? t('cycle.ring.periodDay', { values: { count: day } })
      : next && next.daysUntil > 0
        ? approx + t('cycle.ring.periodsIn', { values: { count: next.daysUntil } })
        : next
          ? t('cycle.ring.periodsToday')
          : t('cycle.ring.day', { values: { count: day } });

  const big = size >= 260;
  const padX = Math.round(size * 0.12);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Top anchor : cycle start date (day 1 sits at 12 o'clock). */}
      <span className="text-[11px] tabular-nums text-muted">{fmtDate(startIso)}</span>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
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
            <circle
              cx={ovPoint.x}
              cy={ovPoint.y}
              r={5.5}
              className="fill-bg stroke-accent"
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

      {/* Bottom anchor : mid-cycle date (6 o'clock = half a turn). */}
      {midDate ? (
        <span className="text-[11px] tabular-nums text-muted">{fmtDate(midDate)}</span>
      ) : null}
    </div>
  );
}
