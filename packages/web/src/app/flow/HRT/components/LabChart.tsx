/**
 * HRT · Analyses — hand-rolled SVG time-series chart.
 *
 * No charting library in the stack (by design — keeps the E2E bundle
 * small; see `ScoreDonut` / `Heatmap` for the same SVG-by-hand
 * approach). Plots one marker's readings over time : a gradient area
 * under an accent polyline, a haloed dot per reading, light
 * y-gridlines and evenly-spaced date labels. Hover a dot for the exact
 * value via the native `<title>` tooltip.
 *
 * Rendered at a **fixed pixel height** (260) with a width measured from
 * the container (ResizeObserver) — so the chart never balloons
 * vertically the way a width-scaled `viewBox` does, and strokes / dots
 * stay perfectly round at any width. Opt into `fillHeight` to instead
 * fill the parent's height (used by the Summary dashboard, where the
 * chart matches the product list); the height is then measured too.
 *
 * Pure presentation : the caller converts every point to a single
 * `unit` first (see `LabsView`), so the chart never reasons about
 * units — it just scales numbers. An optional `caption` slot replaces
 * the default header text (e.g. a molecule `<Select>`).
 */
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';

import type { HrtDrawContext } from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';

import { drawContextLabel, type HrtTranslate } from '../lib/labels';

export interface ChartPoint {
  dateIso: string;
  value: number;
  context: HrtDrawContext;
}

interface LabChartProps {
  points: ReadonlyArray<ChartPoint>;
  unit: string;
  label: string;
  /** Optional informational target band, in the same `unit` as the
   *  points. Either bound may be absent. Folded into the value scale so
   *  it's always visible, and drawn behind the line. */
  target?: { min?: number; max?: number };
  /** Force the time axis to span a date window (ISO `YYYY-MM-DD`) instead
   *  of the data's own min/max — so a date filter visibly shapes the
   *  chart. An empty bound falls back to the data extent. */
  domain?: { from: string; to: string };
  /** Custom header content, replacing the default « label (unit) »
   *  caption — e.g. a molecule `<Select>` on the Summary dashboard. */
  caption?: ReactNode;
  /** Fill the parent's height instead of the fixed 260 px. The parent
   *  must impose a height (e.g. a stretched grid cell). */
  fillHeight?: boolean;
}

const DEFAULT_HEIGHT = 260;
const MIN_HEIGHT = 140;
// Equal left/right gutters so the plot sits symmetrically inside the
// figure's border. The left still has to host the y-axis value labels
// (`PAD_L - 8`), so 30 px is the floor that keeps a 3-digit reading
// (« 165 ») from clipping while staying balanced with the right.
// Left gutter is wider than the right on purpose now : it carries the
// rotated Y-axis unit title AND the tick value labels (standard charted
// axis). The right has neither.
const PAD_L = 42;
const PAD_R = 30;
const PAD_T = 20;
const PAD_B = 30;
const Y_TICKS = 4;
/** Below this average px-spacing between points, the per-dot halos start
 *  to overlap into a « caterpillar » blob — past it we drop the dots and
 *  let the line + area carry the shape (a year of weekly doses still
 *  shows dots; « toutes les dates » over years doesn't). */
const MIN_DOT_SPACING = 10;

function dateMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime();
}

function fmtValue(v: number): string {
  return Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}

function fmtDate(ms: number, locale: string): string {
  return new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** Track the container's pixel size. Width always fills the SVG ;
 *  height is only read in `fillHeight` mode (else the chart uses the
 *  fixed default). */
function useMeasured(): [RefObject<HTMLDivElement | null>, number, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 640, height: DEFAULT_HEIGHT });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setSize((s) => ({
        width: r.width > 0 ? r.width : s.width,
        height: r.height > 0 ? r.height : s.height,
      }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size.width, size.height];
}

export default function LabChart({
  points,
  unit,
  label,
  target,
  caption,
  fillHeight,
  domain,
}: LabChartProps) {
  const { t, language } = useI18n();
  const [ref, width, measuredH] = useMeasured();
  const gradId = `hrt-area-${useId()}`;
  const height = fillHeight ? Math.max(measuredH, MIN_HEIGHT) : DEFAULT_HEIGHT;

  const body =
    points.length === 0 ? (
      <div
        className={`flex items-center justify-center text-[13px] text-muted ${
          fillHeight ? 'h-full' : 'h-[200px]'
        }`}
      >
        {t('hrt.chart.noData', { values: { label } })}
      </div>
    ) : (
      <Plot
        points={points}
        unit={unit}
        label={label}
        width={width}
        height={height}
        gradId={gradId}
        t={t}
        locale={language}
        {...(target ? { target } : {})}
        {...(domain ? { domain } : {})}
      />
    );

  return (
    <figure
      className={`rounded-lg border border-hair bg-bg p-3 ${
        fillHeight ? 'flex h-full w-full flex-col' : ''
      }`}
    >
      <figcaption className="mb-1 px-1 text-[12px] font-medium text-ink">
        {caption ?? (
          <>
            {label} <span className="font-normal text-muted">({unit})</span>
          </>
        )}
      </figcaption>
      <div ref={ref} className={`relative w-full ${fillHeight ? 'min-h-0 flex-1' : ''}`}>
        {body}
      </div>
    </figure>
  );
}

interface PlotProps extends LabChartProps {
  width: number;
  height: number;
  gradId: string;
  /** Threaded from the parent's `useI18n()` — `Plot` stays a plain
   *  render helper (no second context subscription). */
  t: HrtTranslate;
  locale: string;
}

function Plot({ points, unit, width, height, gradId, target, domain, t, locale }: PlotProps) {
  const [hover, setHover] = useState<number | null>(null);
  const plotW = Math.max(width - PAD_L - PAD_R, 10);
  const plotH = height - PAD_T - PAD_B;
  // Drop the per-point dots (and their hover) once they'd overlap ; the
  // line + area still convey the shape, and filtering to a shorter range
  // brings the dots back.
  const showDots =
    points.length <= 1 || plotW / (points.length - 1) >= MIN_DOT_SPACING;

  const times = points.map((p) => dateMs(p.dateIso));
  const values = points.map((p) => p.value);
  // Fold the target bounds into the value scale so the band is always
  // visible even when it sits outside the data range.
  const targetVals = [target?.min, target?.max].filter(
    (v): v is number => typeof v === 'number',
  );
  const scaleVals = values.concat(targetVals);

  // Time axis : a `domain` (from a date filter) wins over the data extent,
  // so the chart spans the selected window even when data is sparse. An
  // empty bound falls back to the data.
  const xMin = domain?.from ? dateMs(domain.from) : Math.min(...times);
  let xMax = domain?.to ? dateMs(domain.to) : Math.max(...times);
  if (xMin >= xMax) xMax = xMin + 1;

  const vMinData = Math.min(...scaleVals);
  const vMaxData = Math.max(...scaleVals);
  const span = vMaxData - vMinData;
  const padV = span === 0 ? Math.abs(vMaxData) * 0.1 || 1 : span * 0.14;
  const vMin = vMinData - padV;
  const vMax = vMaxData + padV;

  const x = (t: number) =>
    points.length === 1 ? PAD_L + plotW / 2 : PAD_L + ((t - xMin) / (xMax - xMin)) * plotW;
  const y = (v: number) => PAD_T + (1 - (v - vMin) / (vMax - vMin)) * plotH;

  const coords = points.map((p, i) => ({ cx: x(times[i] ?? 0), cy: y(p.value), p }));
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.cx.toFixed(1)} ${c.cy.toFixed(1)}`).join(' ');
  const yBottom = PAD_T + plotH;
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1]!.cx.toFixed(1)} ${yBottom} L ${coords[0]!.cx.toFixed(1)} ${yBottom} Z`
      : '';

  // Evenly-spaced value gridlines across the data range.
  const yTicks = Array.from({ length: Y_TICKS }, (_, i) =>
    vMaxData - (i * (vMaxData - vMinData)) / (Y_TICKS - 1),
  );
  // Date labels — a handful, evenly spread over time.
  const xCount = points.length === 1 ? 1 : Math.min(points.length, Math.max(2, Math.floor(plotW / 130)));
  const xTicks =
    xCount === 1
      ? [xMin]
      : Array.from({ length: xCount }, (_, i) => xMin + (i * (xMax - xMin)) / (xCount - 1));

  const active = hover != null ? coords[hover] : null;

  return (
    <>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={t('hrt.chart.ariaLabel', { values: { unit } })}
      >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" className="text-accent" stopOpacity={0.22} />
          <stop offset="100%" stopColor="currentColor" className="text-accent" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Y-axis unit title — rotated alongside the axis, the standard
          charted-axis convention. */}
      {unit ? (
        <text
          x={11}
          y={PAD_T + plotH / 2}
          transform={`rotate(-90 11 ${PAD_T + plotH / 2})`}
          textAnchor="middle"
          fill="currentColor"
          className="fill-current text-[10px] text-muted"
        >
          {unit}
        </text>
      ) : null}

      {/* Y gridlines + labels */}
      {yTicks.map((v, i) => {
        const yy = y(v);
        return (
          <g key={`y-${i}`}>
            <line
              x1={PAD_L}
              x2={width - PAD_R}
              y1={yy}
              y2={yy}
              stroke="currentColor"
              strokeWidth={1}
              className="text-hair"
            />
            <text
              x={PAD_L - 8}
              y={yy}
              textAnchor="end"
              dominantBaseline="middle"
              fill="currentColor"
              className="fill-current text-[10px] text-muted tabular-nums"
            >
              {fmtValue(v)}
            </text>
          </g>
        );
      })}

      {/* X labels */}
      {xTicks.map((tick, i) => (
        <text
          key={`x-${i}`}
          x={x(tick)}
          y={height - 8}
          textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
          fill="currentColor"
          className="fill-current text-[10px] text-muted"
        >
          {fmtDate(tick, locale)}
        </text>
      ))}

      {/* Target / reference band (informational) */}
      {target && (target.min != null || target.max != null) ? (
        <g className="text-accent">
          {target.min != null && target.max != null ? (
            <rect
              x={PAD_L}
              width={plotW}
              y={y(target.max)}
              height={Math.max(y(target.min) - y(target.max), 0)}
              fill="currentColor"
              opacity={0.1}
            />
          ) : null}
          {target.max != null ? (
            <line
              x1={PAD_L}
              x2={width - PAD_R}
              y1={y(target.max)}
              y2={y(target.max)}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.5}
            />
          ) : null}
          {target.min != null ? (
            <line
              x1={PAD_L}
              x2={width - PAD_R}
              y1={y(target.min)}
              y2={y(target.min)}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.5}
            />
          ) : null}
        </g>
      ) : null}

      {/* Area + line */}
      {areaPath ? <path d={areaPath} fill={`url(#${gradId})`} className="text-accent" /> : null}
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-accent"
      />

      {/* Points : soft halo + solid dot with a light ring. Hidden when
          too dense (see `showDots`) so they don't blob into a caterpillar. */}
      {showDots
        ? coords.map(({ cx, cy, p }, i) => (
            <g
              key={p.dateIso + i}
              className="text-accent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <circle cx={cx} cy={cy} r={hover === i ? 9 : 7} fill="currentColor" opacity={0.14} />
              <circle
                cx={cx}
                cy={cy}
                r={hover === i ? 5 : 4}
                fill="currentColor"
                stroke="currentColor"
                strokeWidth={2}
                className="[stroke:var(--color-bg,#fff)]"
              />
              {/* Bigger transparent hit area for an easier hover target. */}
              <circle cx={cx} cy={cy} r={11} fill="transparent" />
            </g>
          ))
        : null}
      </svg>
      {active ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-hair bg-bg px-2 py-1 text-[11px] text-ink shadow-sm"
          style={{ left: active.cx, top: active.cy - 10 }}
        >
          <span className="tabular-nums">
            {fmtDate(dateMs(active.p.dateIso), locale)} — {fmtValue(active.p.value)} {unit}
          </span>
          {active.p.context !== 'unknown' ? (
            <span className="text-muted"> ({drawContextLabel(t, active.p.context)})</span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
