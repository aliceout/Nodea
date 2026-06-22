import type { HrtDrawContext } from '@nodea/shared';

/**
 * A single point plotted by `LabChart` / `LabChartPlot` — one reading
 * (lab result or administered dose) at a date, in the chart's single
 * unit (the caller converts before plotting). Lives in `lib/` so both
 * the chart wrapper and the extracted SVG plot (and the PDF export /
 * chart-data builders) can import it without a component-graph cycle.
 */
export interface ChartPoint {
  dateIso: string;
  value: number;
  context: HrtDrawContext;
}
