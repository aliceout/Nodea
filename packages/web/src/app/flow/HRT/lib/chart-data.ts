/**
 * HRT · Analyses — pure helpers turning decrypted lab entries into the
 * `LabChart` input for one marker + display unit. Conversion goes
 * through the shared marker presets ; readings whose unit can't be
 * converted to the chosen display unit are dropped and counted so the
 * view can warn rather than plot a misleading point.
 */
import { convertMarkerValue, findMarker } from '@nodea/shared';

import type { LabResultEntry } from '../data/use-lab-results';
import type { ChartPoint } from '../components/LabChart';

export interface MarkerCount {
  key: string;
  count: number;
}

/** Distinct marker keys present in the data, most-readings-first. */
export function distinctMarkers(
  entries: ReadonlyArray<LabResultEntry>,
): MarkerCount[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    counts.set(e.payload.marker, (counts.get(e.payload.marker) ?? 0) + 1);
  }
  return Array.from(counts, ([key, count]) => ({ key, count })).sort(
    (a, b) => b.count - a.count || a.key.localeCompare(b.key),
  );
}

/** Units offered for a marker : the preset's units, unioned with any
 *  units actually present in the data (so free-text units still show). */
export function unitsForMarker(
  entries: ReadonlyArray<LabResultEntry>,
  markerKey: string,
): string[] {
  const preset = findMarker(markerKey);
  const set = new Set<string>(preset ? preset.units : []);
  for (const e of entries) {
    if (e.payload.marker === markerKey && e.payload.unit) set.add(e.payload.unit);
  }
  return Array.from(set);
}

/** Default display unit for a marker : its canonical preset unit, else
 *  the most common unit seen in the data. */
export function defaultUnitForMarker(
  entries: ReadonlyArray<LabResultEntry>,
  markerKey: string,
): string {
  const preset = findMarker(markerKey);
  if (preset) return preset.canonicalUnit;
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.payload.marker === markerKey && e.payload.unit) {
      counts.set(e.payload.unit, (counts.get(e.payload.unit) ?? 0) + 1);
    }
  }
  let best = '';
  let bestN = -1;
  for (const [unit, n] of counts) {
    if (n > bestN) {
      best = unit;
      bestN = n;
    }
  }
  return best;
}

export interface ChartSeries {
  points: ChartPoint[];
  /** Readings dropped because their unit couldn't be converted. */
  skipped: number;
}

/** Build the plotted series for one marker in `displayUnit`. */
export function buildChartSeries(
  entries: ReadonlyArray<LabResultEntry>,
  markerKey: string,
  displayUnit: string,
): ChartSeries {
  const preset = findMarker(markerKey);
  const points: ChartPoint[] = [];
  let skipped = 0;

  for (const e of entries) {
    if (e.payload.marker !== markerKey) continue;
    let value: number | null;
    if (e.payload.unit === displayUnit) {
      value = e.payload.value;
    } else if (preset) {
      value = convertMarkerValue(preset, e.payload.value, e.payload.unit, displayUnit);
    } else {
      value = null;
    }
    if (value === null) {
      skipped += 1;
      continue;
    }
    points.push({ dateIso: e.payload.date, value, context: e.payload.context });
  }

  points.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  return { points, skipped };
}
