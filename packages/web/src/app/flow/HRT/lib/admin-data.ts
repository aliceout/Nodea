/**
 * HRT · Administration — pure helpers turning decrypted dose logs into
 * the molecule grouping + `LabChart` input for the journal.
 *
 * Doses are grouped by MOLECULE (via the product join), not by product :
 * the user can switch product / supplier while staying on the same
 * molecule and wants the filter + chart to follow the molecule. The
 * series is in mg-equivalent so different products / forms of one
 * molecule are comparable — a mL dose uses its product's concentration,
 * a mg dose is taken as-is, anything else is dropped and counted.
 */
import type { HrtProductPayload } from '@nodea/shared';

import type { AdminLogEntry } from '../hooks/use-admin-logs';
import type { ChartPoint } from '../components/LabChart';

export type ProductByName = ReadonlyMap<string, HrtProductPayload>;

export interface MoleculeCount {
  name: string;
  count: number;
}

/** The molecule a dose belongs to : its product's medication, falling
 *  back to the raw product name when the product can't be resolved. */
export function moleculeOf(entry: AdminLogEntry, products: ProductByName): string {
  const med = products.get(entry.payload.product)?.medication?.trim();
  return med || entry.payload.product;
}

/** Distinct molecules present in the log, most-doses-first. */
export function distinctMolecules(
  entries: ReadonlyArray<AdminLogEntry>,
  products: ProductByName,
): MoleculeCount[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const mol = moleculeOf(e, products);
    counts.set(mol, (counts.get(mol) ?? 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

export interface DoseSeries {
  points: ChartPoint[];
  /** Doses dropped because they couldn't be expressed in mg. */
  skipped: number;
}

/** Build the mg-equivalent dose series for one molecule over time. */
export function buildDoseSeries(
  entries: ReadonlyArray<AdminLogEntry>,
  molecule: string,
  products: ProductByName,
): DoseSeries {
  const points: ChartPoint[] = [];
  let skipped = 0;
  for (const e of entries) {
    if (moleculeOf(e, products) !== molecule) continue;
    const p = products.get(e.payload.product);
    let mg: number | null;
    // A concentration (mg/mL) ⇒ the dose is a volume (mL) → mg = mL × conc,
    // regardless of the product's stored `unit`. A plain mg dose is taken
    // as-is ; anything else can't be expressed in mg.
    if (typeof p?.concentration === 'number') {
      mg = e.payload.dose * p.concentration;
    } else if (p?.unit === 'mg') {
      mg = e.payload.dose;
    } else {
      mg = null;
    }
    if (mg == null) {
      skipped += 1;
      continue;
    }
    points.push({ dateIso: e.payload.date, value: mg, context: 'unknown' });
  }
  points.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  return { points, skipped };
}
