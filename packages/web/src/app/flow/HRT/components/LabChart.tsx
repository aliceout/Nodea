/**
 * HRT · Analyses — hand-rolled SVG time-series chart (wrapper).
 *
 * No charting library in the stack (by design — keeps the E2E bundle
 * small; see `ScoreDonut` / `Heatmap` for the same SVG-by-hand
 * approach). This file is the thin shell : a `<figure>` with an optional
 * caption, the container-size measurement (ResizeObserver), and the
 * empty state. The actual SVG plotting lives in `LabChartPlot`
 * (REFACTO-08) so the maths is isolated + unit-testable.
 *
 * Rendered at a **fixed pixel height** (260) with a width measured from
 * the container — so the chart never balloons vertically the way a
 * width-scaled `viewBox` does, and strokes / dots stay round at any
 * width. Opt into `fillHeight` to instead fill the parent's height (used
 * by the Summary dashboard); the height is then measured too.
 *
 * Pure presentation : the caller converts every point to a single `unit`
 * first (see `LabsView`), so the chart never reasons about units. An
 * optional `caption` slot replaces the default header text.
 */
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';

import type { ChartPoint } from '../lib/chart-point';
import LabChartPlot from './LabChartPlot';

// Re-exported for the consumers that import the point shape from here
// (export-pdf, export-model, chart-data, admin-data, DoseChartPanel); the
// type itself lives in `lib/chart-point` so the extracted plot can share
// it without a component-graph cycle.
export type { ChartPoint };

interface LabChartProps {
  points: ReadonlyArray<ChartPoint>;
  unit: string;
  label: string;
  /** Optional informational target band, in the same `unit` as the
   *  points. Either bound may be absent. */
  target?: { min?: number; max?: number };
  /** Force the time axis to span a date window (ISO `YYYY-MM-DD`) instead
   *  of the data's own min/max. An empty bound falls back to the data. */
  domain?: { from: string; to: string };
  /** Custom header content, replacing the default « label (unit) »
   *  caption — e.g. a molecule `<Select>` on the Summary dashboard. */
  caption?: ReactNode;
  /** Fill the parent's height instead of the fixed 260 px. */
  fillHeight?: boolean;
}

const DEFAULT_HEIGHT = 260;
const MIN_HEIGHT = 140;

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
      <LabChartPlot
        points={points}
        unit={unit}
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
