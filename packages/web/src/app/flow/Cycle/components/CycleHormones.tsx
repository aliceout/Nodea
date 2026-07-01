/**
 * Standard hormone view (3rd graph) — a full-width linear chart of the
 * TEXTBOOK hormone curves for the chosen reference profile (natal cycle /
 * masculinising HRT), with a « you are here » marker at today's cycle day
 * and a cycle-day axis underneath (so a flat masc profile still reads as
 * « steady across the whole cycle » rather than empty lines). INDICATIVE
 * average shapes, NOT the user's measured levels (that would be lab data →
 * HRT). Profile + on/off live in the module settings. Hand-rolled SVG — no
 * chart lib.
 */
import { useMemo } from 'react';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { phaseSegments, type CyclePhase } from '../lib/cycle-model';
import {
  sampleHormones,
  type HormoneId,
  type HormoneProfile,
  type HormoneSeries,
} from '../lib/hormones';

interface Props {
  length: number;
  day: number | null;
  profile: HormoneProfile;
}

const W = 340;
const H = 100;
const PAD = 6;
/** Standard menstrual length for the textbook phase band under the curves. */
const BAND_PERIOD_DAYS = 5;

const HORMONE_COLOR: Record<HormoneId, string> = {
  estrogen: 'stroke-accent',
  progesterone: 'stroke-ink-soft',
  lh: 'stroke-low',
  testosterone: 'stroke-low-deep',
};

const PHASE_BAND_BG: Record<Exclude<CyclePhase, 'ovulation'>, string> = {
  menstrual: 'bg-low-soft',
  follicular: 'bg-phase-follicular',
  fertile: 'bg-accent-soft',
  luteal: 'bg-phase-luteal',
};

/** Smooth path through points via Catmull-Rom → cubic béziers. */
function smooth(pts: ReadonlyArray<{ x: number; y: number }>): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function CycleHormones({ length, day, profile }: Props) {
  const { t } = useI18n();
  const { series, ovulation } = useMemo(
    () => sampleHormones(length, profile),
    [length, profile],
  );

  const x = (dayNum: number) => ((dayNum - 1) / Math.max(1, length - 1)) * W;
  const y = (v: number) => H - PAD - v * (H - 2 * PAD);
  const curve = (s: HormoneSeries) =>
    smooth(s.y.map((v, i) => ({ x: x(i + 1), y: y(v) })));

  // Day-axis ticks : day 1, each week that clears the end by ≥ 3 days, and
  // the last day. Skipping near-end weeks avoids « J28 J30 » collisions on
  // longer cycles. ponytail: fixed week grid, fine for any realistic length.
  const pctX = (d: number) => ((d - 1) / Math.max(1, length - 1)) * 100;
  const ticks = [1, ...[7, 14, 21, 28, 35].filter((d) => d < length - 2), length];

  // Phase band under the curves (natal only — a masc HRT profile has no
  // cycle). Explains which hormonal phase each region of the graph is.
  const phaseLabel: Record<Exclude<CyclePhase, 'ovulation'>, string> = {
    menstrual: t('cycle.phase.menstrual'),
    follicular: t('cycle.phase.follicular'),
    fertile: t('cycle.phase.fertile'),
    luteal: t('cycle.phase.luteal'),
  };
  const bandSegments =
    ovulation !== null ? phaseSegments(length, BAND_PERIOD_DAYS, ovulation) : [];

  return (
    <div className="flex h-full flex-col px-1 py-1">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[13px] font-semibold text-ink">{t('cycle.hormones.title')}</h3>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <svg width="14" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="14" y2="3" className={HORMONE_COLOR[s.id]} strokeWidth={2} />
              </svg>
              {t(`cycle.hormones.${s.id}`)}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Y-axis legend — the vertical is an INDICATIVE relative level, not
            measured values : « élevé » at the top, « faible » at the baseline.
            Kept a sibling of the plot so the x-day ticks below stay aligned
            under the curves only, not this gutter. */}
        <div className="flex shrink-0 flex-col justify-between py-0.5 pr-1.5 text-right text-[9.5px] leading-none text-muted-soft">
          <span>{t('cycle.hormones.axis.high')}</span>
          <span>{t('cycle.hormones.axis.low')}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex-1">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
            >
              {/* Vertical scale — faint gridlines at low / mid / high, so the
                  « élevé / faible » gutter reads as a real axis. */}
              {[0, 0.5, 1].map((v) => (
                <line
                  key={v}
                  x1={0}
                  y1={y(v)}
                  x2={W}
                  y2={y(v)}
                  className="stroke-hair"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {ovulation !== null ? (
                <line x1={x(ovulation)} y1={0} x2={x(ovulation)} y2={H} className="stroke-accent-soft" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ) : null}
              {series.map((s) => (
                <path
                  key={s.id}
                  d={curve(s)}
                  fill="none"
                  className={HORMONE_COLOR[s.id]}
                  strokeWidth={1.25}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {day !== null && day >= 1 && day <= length ? (
                <line
                  x1={x(day)}
                  y1={0}
                  x2={x(day)}
                  y2={H}
                  className="stroke-ink"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </svg>
          </div>

          {/* Cycle-day axis — anchored to the same x-scale as the curves.
              First tick flush-left, last flush-right, the rest centred. */}
          <div className="relative mt-1 h-3.5">
            {ticks.map((d, i) => (
              <span
                key={d}
                className={`absolute top-0 text-[9.5px] tabular-nums text-muted-soft ${
                  i === 0 ? '' : i === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2'
                }`}
                style={{ left: `${pctX(d)}%` }}
              >
                {t('cycle.ring.dayBadge', { values: { count: d } })}
              </span>
            ))}
          </div>

          {/* Phase band — a horizontal scale under the curves naming each
              phase, aligned to the same day x-scale. Contiguous segments : a
              segment runs to the next one's start. */}
          {bandSegments.length > 0 ? (
            <div className="relative mt-1 h-4">
              {bandSegments.map((s, i, arr) => {
                const left = pctX(s.from);
                const right = i < arr.length - 1 ? pctX(arr[i + 1]!.from) : 100;
                return (
                  <div
                    key={s.phase}
                    className={`absolute inset-y-0 flex items-center justify-center overflow-hidden rounded-[2px] text-[8px] leading-none text-ink-soft ${PHASE_BAND_BG[s.phase]}`}
                    style={{ left: `${left}%`, width: `${right - left}%` }}
                    title={phaseLabel[s.phase]}
                  >
                    <span className="truncate px-0.5">{phaseLabel[s.phase]}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-1 text-[11px] leading-snug text-muted-soft">
        {t('cycle.hormones.disclaimer')}
      </p>
    </div>
  );
}
