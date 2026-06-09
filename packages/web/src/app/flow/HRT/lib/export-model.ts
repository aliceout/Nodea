/**
 * HRT · Export — pure builders turning the four decrypted collections
 * into the shapes the doctor-export report and its CSV downloads consume.
 *
 * Where it sits : the lib layer of the HRT module, beside `admin-data`
 * (dose grouping) and `chart-data` (lab series) whose helpers it reuses —
 * so the export never re-derives the mL→mg join or the unit conversion,
 * it leans on the same single source the live views do. Pure functions,
 * no React, no I/O : the view passes decrypted entries in (plus its
 * `useI18n()` translator for the display labels), gets display + CSV
 * rows out, and stays thin.
 *
 * Three sections : the **current regimen** (the ongoing recurring series,
 * `endDate == null` — same « en cours » rule as `SchedulesPanel`), the
 * **dose history** (admin logs in the selected range, enriched with the
 * product join + mg-equivalent), and the **lab groups** (results in range
 * grouped by marker, carrying both raw readings for the table and a
 * converted series for the chart).
 */
import type { HrtDrawContext, HrtProductPayload } from '@nodea/shared';

import type { AdminLogEntry } from '../hooks/use-admin-logs';
import type { LabResultEntry } from '../hooks/use-lab-results';
import type { ScheduleEntry } from '../hooks/use-schedules';
import type { ChartPoint } from '../components/LabChart';
import { buildDoseSeries, distinctMolecules, moleculeOf, type ProductByName } from './admin-data';
import { buildChartSeries, defaultUnitForMarker } from './chart-data';
import { inDateRange, type DateRange } from './date-range';
import {
  categoryLabel,
  drawContextLabel,
  frequencyLabel,
  markerLabel,
  routeLabel,
  type HrtTranslate,
} from './labels';

type ProductLike = Pick<HrtProductPayload, 'unit' | 'concentration'> | undefined;

/**
 * A product carrying a mg/mL `concentration` is dosed by VOLUME — the
 * concentration only makes sense for a mL dose. So the **effective** dose
 * unit is `mL` whenever a concentration is set (even if a legacy product's
 * stored `unit` says otherwise) ; otherwise the product's own unit. The
 * conversion is thus a property of the *dose entry*, derived at read time,
 * never baked into the product.
 */
export function doseUnitOf(product: ProductLike): string {
  if (!product) return '';
  return typeof product.concentration === 'number' ? 'mL' : product.unit;
}

/** mg-equivalent of a dose : `mL × concentration`, rounded to 0.1 mg, for a
 *  product with a concentration ; `null` otherwise (not a volume dose). */
export function mgEquivalent(dose: number, product: ProductLike): number | null {
  if (product && typeof product.concentration === 'number') {
    return Math.round(dose * product.concentration * 10) / 10;
  }
  return null;
}

/** Human dose string, e.g. « 0.4 mL ≈ 4 mg » or « 100 mg ». */
export function formatDose(dose: number, unit: string, mgEq: number | null): string {
  return `${dose}${unit ? ` ${unit}` : ''}${mgEq != null ? ` ≈ ${mgEq} mg` : ''}`;
}

// ── Current regimen ─────────────────────────────────────────────────────

export interface RegimenRow {
  id: string;
  product: string;
  molecule: string;
  categoryLabel: string;
  doseText: string;
  cadence: string;
  routeLabel: string;
  startDate: string;
}

/**
 * The ongoing recurring series, as regimen rows. « Ongoing » is
 * `endDate == null` (a stopped series carries its end date) — the same
 * rule the *Prises récurrentes en cours* panel uses. Sorted by category
 * then molecule so estrogens, anti-androgens… read as grouped blocks.
 * Display labels resolve through the caller's `t` (threaded, not
 * imported — keeps this module pure and locale-agnostic).
 */
export function buildRegimen(
  schedules: ReadonlyArray<ScheduleEntry>,
  products: ProductByName,
  t: HrtTranslate,
): RegimenRow[] {
  const rows = schedules
    .filter((s) => s.payload.endDate == null)
    .map((s) => {
      const product = products.get(s.payload.product);
      const mgEq = mgEquivalent(s.payload.dose, product);
      return {
        id: s.id,
        product: s.payload.product,
        molecule: product?.medication?.trim() || s.payload.product,
        categoryLabel: product ? categoryLabel(t, product.category) : '',
        doseText: formatDose(s.payload.dose, doseUnitOf(product), mgEq),
        cadence: frequencyLabel(t, s.payload.frequency, s.payload.everyNDays),
        routeLabel: product ? routeLabel(t, product.route) : '',
        startDate: s.payload.startDate,
      };
    });
  rows.sort(
    (a, b) =>
      a.categoryLabel.localeCompare(b.categoryLabel) ||
      a.molecule.localeCompare(b.molecule),
  );
  return rows;
}

// ── Dose history ────────────────────────────────────────────────────────

export interface DoseRow {
  id: string;
  date: string;
  time: string;
  product: string;
  molecule: string;
  categoryLabel: string;
  routeLabel: string;
  dose: number;
  unit: string;
  mgEq: number | null;
  /** The product's mg/mL concentration, when set (for the PDF product cell). */
  concentration?: number;
  auto: boolean;
  notes: string;
}

/**
 * Admin logs within the range, enriched with the product join + the
 * mg-equivalent, newest-first. `auto` flags occurrences generated from a
 * recurring schedule (they carry a `scheduleId`).
 */
export function buildDoseHistory(
  entries: ReadonlyArray<AdminLogEntry>,
  products: ProductByName,
  range: DateRange,
  t: HrtTranslate,
): DoseRow[] {
  return entries
    .filter((e) => inDateRange(e.payload.date, range))
    .map((e) => {
      const product = products.get(e.payload.product);
      return {
        id: e.id,
        date: e.payload.date,
        time: e.payload.time,
        product: e.payload.product,
        molecule: moleculeOf(e, products),
        categoryLabel: product ? categoryLabel(t, product.category) : '',
        routeLabel: product ? routeLabel(t, product.route) : '',
        dose: e.payload.dose,
        unit: doseUnitOf(product),
        mgEq: mgEquivalent(e.payload.dose, product),
        ...(typeof product?.concentration === 'number'
          ? { concentration: product.concentration }
          : {}),
        auto: Boolean(e.payload.scheduleId),
        notes: e.payload.notes,
      };
    })
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}

// ── Dose charts ─────────────────────────────────────────────────────────

export interface DoseChart {
  molecule: string;
  /** mg-equivalent dose series over time (mL × concentration, or mg). */
  points: ChartPoint[];
  /** Doses dropped because they couldn't be expressed in mg. */
  skipped: number;
}

/**
 * One mg-equivalent dose series per molecule administered within the
 * range, for the landscape charts section (reuses the Administration
 * `buildDoseSeries`). The caller filters by the selected molecules and
 * keeps only series worth a chart (≥ 2 points).
 */
export function buildDoseCharts(
  entries: ReadonlyArray<AdminLogEntry>,
  products: ProductByName,
  range: DateRange,
): DoseChart[] {
  const inRange = entries.filter((e) => inDateRange(e.payload.date, range));
  return distinctMolecules(inRange, products).map(({ name }) => {
    const series = buildDoseSeries(inRange, name, products);
    return { molecule: name, points: series.points, skipped: series.skipped };
  });
}

// ── Lab groups ──────────────────────────────────────────────────────────

export interface LabReading {
  id: string;
  date: string;
  value: number;
  unit: string;
  context: HrtDrawContext;
  contextLabel: string;
  lab: string;
  notes: string;
}

export interface LabGroup {
  key: string;
  label: string;
  /** Unit the chart normalises to (the marker's canonical unit, else the
   *  most common unit seen). The table shows each reading's stored unit. */
  displayUnit: string;
  points: ChartPoint[];
  /** Readings dropped from the chart because their unit couldn't convert
   *  to `displayUnit` (still listed in the table). */
  skipped: number;
  /** Raw readings, oldest-first (chronological — reads as a trend). */
  readings: LabReading[];
}

/**
 * Lab results within the range, grouped by marker. Each group carries the
 * raw readings (for the table) and a converted point series (for the
 * chart). Groups are ordered most-measured-first so the markers a clinician
 * tracks closely lead the section.
 */
export function buildLabGroups(
  entries: ReadonlyArray<LabResultEntry>,
  range: DateRange,
  t: HrtTranslate,
): LabGroup[] {
  const filtered = entries.filter((e) => inDateRange(e.payload.date, range));
  const keys = new Map<string, number>();
  for (const e of filtered) keys.set(e.payload.marker, (keys.get(e.payload.marker) ?? 0) + 1);

  const groups = Array.from(keys.keys()).map((key) => {
    const displayUnit = defaultUnitForMarker(filtered, key);
    const series = buildChartSeries(filtered, key, displayUnit);
    const readings: LabReading[] = filtered
      .filter((e) => e.payload.marker === key)
      .map((e) => ({
        id: e.id,
        date: e.payload.date,
        value: e.payload.value,
        unit: e.payload.unit,
        context: e.payload.context,
        contextLabel:
          e.payload.context === 'unknown' ? '' : drawContextLabel(t, e.payload.context),
        lab: e.payload.lab,
        notes: e.payload.notes,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      key,
      label: markerLabel(key),
      displayUnit,
      points: series.points,
      skipped: series.skipped,
      readings,
    };
  });

  groups.sort((a, b) => b.readings.length - a.readings.length || a.label.localeCompare(b.label));
  return groups;
}

// ── Grouping (the « Grouper par » toggle) ───────────────────────────────

/** How the report's tables are organised : by molecule/marker `type`
 *  (each substance's rows together) or flat by `date` (chronological,
 *  every substance mixed). */
export type ExportGroupBy = 'type' | 'date';

export interface DoseGroup {
  molecule: string;
  rows: DoseRow[];
}

/**
 * Group dose rows by molecule for the « grouper par type » view. Rows keep
 * `buildDoseHistory`'s newest-first order within each group ; groups are
 * ordered by molecule name so the list is stable and scannable.
 */
export function groupDosesByMolecule(rows: ReadonlyArray<DoseRow>): DoseGroup[] {
  const map = new Map<string, DoseRow[]>();
  for (const r of rows) {
    const arr = map.get(r.molecule);
    if (arr) arr.push(r);
    else map.set(r.molecule, [r]);
  }
  return Array.from(map, ([molecule, rs]) => ({ molecule, rows: rs })).sort((a, b) =>
    a.molecule.localeCompare(b.molecule),
  );
}

export interface FlatLabReading extends LabReading {
  markerLabel: string;
}

/**
 * Flatten every marker group's readings into one chronological
 * (newest-first) list for the « grouper par date » analyses view, tagging
 * each reading with its marker label.
 */
export function flattenLabReadings(groups: ReadonlyArray<LabGroup>): FlatLabReading[] {
  return groups
    .flatMap((g) => g.readings.map((r) => ({ ...r, markerLabel: g.label })))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ── Data matrices ────────────────────────────────────────────────────────
// Header row + records, ready for a spreadsheet writer. Dates stay ISO (`YYYY-MM-DD`)
// here — sortable + locale-free in a spreadsheet, unlike the French long
// form the printed report uses.

export function doseMatrix(
  doses: ReadonlyArray<DoseRow>,
  t: HrtTranslate,
): (string | number)[][] {
  const header = ['date', 'time', 'product', 'molecule', 'category', 'route', 'dose', 'unit', 'mgEq', 'type', 'notes']
    .map((k) => t(`hrt.export.matrix.${k}`));
  const rows = doses.map((d) => [
    d.date, d.time, d.product, d.molecule, d.categoryLabel,
    d.routeLabel, d.dose, d.unit, d.mgEq ?? '',
    d.auto ? t('hrt.export.matrix.typeRecurring') : t('hrt.export.matrix.typeManual'), d.notes,
  ]);
  return [header, ...rows];
}

export function labMatrix(
  groups: ReadonlyArray<LabGroup>,
  t: HrtTranslate,
): (string | number)[][] {
  const header = ['date', 'marker', 'value', 'unit', 'context', 'lab', 'notes']
    .map((k) => t(`hrt.export.matrix.${k}`));
  const rows = groups.flatMap((g) =>
    g.readings.map((r) => [r.date, g.label, r.value, r.unit, r.contextLabel, r.lab, r.notes]),
  );
  return [header, ...rows];
}
