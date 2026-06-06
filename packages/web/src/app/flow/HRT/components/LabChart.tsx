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
 * Rendered at a **fixed pixel height** with a width measured from the
 * container (ResizeObserver) — so the chart never balloons vertically
 * the way a width-scaled `viewBox` does, and strokes / dots stay
 * perfectly round at any width.
 *
 * Pure presentation : the caller converts every point to a single
 * `unit` first (see `LabsView`), so the chart never reasons about
 * units — it just scales numbers.
 */
import { useEffect, useId, useRef, useState, type RefObject } from 'react';

import type { HrtDrawContext } from '@nodea/shared';

import { HRT_DRAW_CONTEXT_LABELS } from '../lib/labels';

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
}

const HEIGHT = 260;
const PAD_L = 48;
const PAD_R = 20;
const PAD_T = 20;
const PAD_B = 30;
const Y_TICKS = 4;

function dateMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime();
}

function fmtValue(v: number): string {
  return Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Track the container's pixel width so the SVG fills it at a fixed
 *  height without `viewBox` up-scaling. */
function useMeasuredWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export default function LabChart({ points, unit, label, target }: LabChartProps) {
  const [ref, width] = useMeasuredWidth();
  const gradId = `hrt-area-${useId()}`;

  const body =
    points.length === 0 ? (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-muted">
        Pas encore de données pour {label}.
      </div>
    ) : (
      <Plot
        points={points}
        unit={unit}
        label={label}
        width={width}
        gradId={gradId}
        {...(target ? { target } : {})}
      />
    );

  return (
    <figure className="rounded-lg border border-hair bg-bg p-3">
      <figcaption className="mb-1 px-1 text-[12px] font-medium text-ink">
        {label} <span className="font-normal text-muted">({unit})</span>
      </figcaption>
      <div ref={ref} className="relative w-full">
        {body}
      </div>
    </figure>
  );
}

interface PlotProps extends LabChartProps {
  width: number;
  gradId: string;
}

function Plot({ points, unit, width, gradId, target }: PlotProps) {
  const [hover, setHover] = useState<number | null>(null);
  const plotW = Math.max(width - PAD_L - PAD_R, 10);
  const plotH = HEIGHT - PAD_T - PAD_B;

  const times = points.map((p) => dateMs(p.dateIso));
  const values = points.map((p) => p.value);
  // Fold the target bounds into the value scale so the band is always
  // visible even when it sits outside the data range.
  const targetVals = [target?.min, target?.max].filter(
    (v): v is number => typeof v === 'number',
  );
  const scaleVals = values.concat(targetVals);

  const xMin = Math.min(...times);
  let xMax = Math.max(...times);
  if (xMin === xMax) xMax = xMin + 1;

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
      <svg width={width} height={HEIGHT} role="img" aria-label={`Évolution en ${unit}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" className="text-accent" stopOpacity={0.22} />
          <stop offset="100%" stopColor="currentColor" className="text-accent" stopOpacity={0} />
        </linearGradient>
      </defs>

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
      {xTicks.map((t, i) => (
        <text
          key={`x-${i}`}
          x={x(t)}
          y={HEIGHT - 8}
          textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
          fill="currentColor"
          className="fill-current text-[10px] text-muted"
        >
          {fmtDate(t)}
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

      {/* Points : soft halo + solid dot with a light ring */}
      {coords.map(({ cx, cy, p }, i) => (
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
      ))}
      </svg>
      {active ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-hair bg-bg px-2 py-1 text-[11px] text-ink shadow-sm"
          style={{ left: active.cx, top: active.cy - 10 }}
        >
          <span className="tabular-nums">
            {fmtDate(dateMs(active.p.dateIso))} — {fmtValue(active.p.value)} {unit}
          </span>
          {active.p.context !== 'unknown' ? (
            <span className="text-muted"> ({HRT_DRAW_CONTEXT_LABELS[active.p.context]})</span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
