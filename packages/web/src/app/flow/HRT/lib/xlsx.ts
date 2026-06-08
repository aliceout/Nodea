/**
 * HRT · Import — the `.xlsx` boundary : decode an uploaded workbook into
 * raw « Analyses » rows, and generate the import template (with in-cell
 * dropdowns for Marqueur + Contexte).
 *
 * Where it sits : the only place `exceljs` is touched, **dynamically
 * imported** (`await import('exceljs')`) so its heavy browser bundle lands
 * in a lazy chunk and never weighs on the main bundle — like jsPDF for the
 * PDF export. Domain rules (validation, matching, dedupe) live in
 * `import-model` ; this file owns only the file <-> rows mechanics, the
 * template layout and the data-validation dropdowns.
 *
 * Why exceljs (a heavier « kitchen-sink » lib than the rest of the stack) :
 * it's the one lib that both reads AND writes `.xlsx` *and* writes in-cell
 * data-validation dropdowns (which `write-excel-file` couldn't), so a single
 * dependency replaces the read + write pair. Listed in `optimizeDeps.include`
 * so the first dynamic import in dev doesn't trigger a re-optimise + full
 * page reload (which would drop the in-memory main key → logout).
 *
 * Why client-side : like every other HRT export, this is decrypted health
 * data — the workbook is built / parsed in the browser, never sent.
 *
 * The dropdowns are **soft** (`showErrorMessage: false`) : markers and
 * contexts are free strings, so the list suggests but never blocks a custom
 * value typed by hand.
 */
import type { Cell, DataValidation, Worksheet } from 'exceljs';

import { HRT_MARKERS } from '@nodea/shared';

import { ANALYSE_TEMPLATE_HEADERS, type RawCell, type RawRow } from './import-model';

export interface ImportWorkbook {
  analyses: RawRow[];
}

const SHEET = 'Analyses';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** Pre-apply the dropdowns down to this many data rows (plenty for analyses;
 *  rows pasted past it still import, just without the in-cell list). */
const TEMPLATE_ROWS = 200;
const CONTEXT_ITEMS = ['Creux', 'Pic', 'Aléatoire', 'Non précisé'] as const;

// ── Reading an uploaded workbook ────────────────────────────────────────

/** Coerce an exceljs cell to a `RawCell` : keep typed values (Date / number
 *  / string / boolean), render anything richer (formula / rich text /
 *  hyperlink) to its display text. */
function cellToRaw(cell: Cell): RawCell {
  const value = cell.value;
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  return cell.text;
}

/**
 * Decode an uploaded `.xlsx` into the « Analyses » rows, keyed by header.
 * A missing « Analyses » sheet yields []. Rows keep their real spreadsheet
 * position (header = row 1) so `import-model`'s « Ligne N » messages line
 * up — blank rows are read as empty and skipped downstream. The parser is
 * lazy-loaded on first use.
 */
export async function readImportWorkbook(file: File): Promise<ImportWorkbook> {
  const { Workbook } = await import('exceljs');
  const wb = new Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet(SHEET);
  if (!ws) return { analyses: [] };

  const headers = new Map<number, string>();
  ws.getRow(1).eachCell((cell, col) => {
    const raw = cellToRaw(cell);
    const text = raw == null ? '' : String(raw).trim();
    if (text !== '') headers.set(col, text);
  });

  const analyses: RawRow[] = [];
  // `includeEmpty` keeps the array index aligned with the row number (a
  // blank middle row stays a blank row, not a shift).
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, RawCell> = {};
    headers.forEach((header, col) => {
      obj[header] = cellToRaw(row.getCell(col));
    });
    analyses.push(obj);
  });
  return { analyses };
}

// ── Generating the template ─────────────────────────────────────────────

/** A soft « pick from this list » in-cell dropdown (an inline list — never
 *  blocking, so a custom marker / context typed by hand still passes). */
function listValidation(items: readonly string[]): DataValidation {
  return {
    type: 'list',
    allowBlank: true,
    showErrorMessage: false,
    formulae: [`"${items.join(',')}"`],
  };
}

/**
 * The « Aide » sheet : instructions + the recognised markers (with their
 * default unit) and contexts, generated from the shared presets so it never
 * drifts. Documentation only — the dropdowns live on the « Analyses » sheet.
 */
function buildAideSheet(ws: Worksheet): void {
  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 16;

  const title = ws.getCell('A1');
  title.value = 'Modèle d’import HRT — Nodea (analyses)';
  title.font = { bold: true };
  ws.getCell('A2').value =
    'Collez vos analyses dans l’onglet « Analyses ». Ne touchez pas aux en-têtes (ligne 1).';
  ws.getCell('A3').value =
    'Dates : 2026-06-04 (AAAA-MM-JJ) ou 04.06.2026. Décimale au point ou à la virgule (1.5 / 1,5).';
  ws.getCell('A4').value =
    'Tout est traité dans votre navigateur — le fichier n’est jamais envoyé au serveur.';

  const markerHead = ws.getCell('A6');
  markerHead.value = 'Marqueurs reconnus';
  markerHead.font = { bold: true };
  const unitHead = ws.getCell('B6');
  unitHead.value = 'Unité par défaut';
  unitHead.font = { bold: true };
  HRT_MARKERS.forEach((m, i) => {
    ws.getCell(7 + i, 1).value = m.label;
    ws.getCell(7 + i, 2).value = m.canonicalUnit;
  });

  const ctxRow = 8 + HRT_MARKERS.length;
  const ctxHead = ws.getCell(ctxRow, 1);
  ctxHead.value = 'Contextes';
  ctxHead.font = { bold: true };
  ws.getCell(ctxRow + 1, 1).value = CONTEXT_ITEMS.join(' · ');
}

/** Trigger a client-side download of `blob` as `filename`. */
function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Build + download the `.xlsx` import template : an « Analyses » sheet
 * (bold headers + Marqueur / Contexte dropdowns) and an « Aide » sheet. The
 * writer is lazy-loaded on first use.
 */
export async function downloadImportTemplate(): Promise<void> {
  const { Workbook } = await import('exceljs');
  const wb = new Workbook();
  wb.creator = 'Nodea';

  const ws = wb.addWorksheet(SHEET);
  ws.columns = ANALYSE_TEMPLATE_HEADERS.map((header) => ({
    header,
    width: header === 'Notes' ? 28 : 16,
  }));
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
  });

  // Soft dropdowns : Marqueur (col 2), Unité (col 4) + Contexte (col 5).
  // The unit list is the union of every preset marker's known units (a
  // marker's units depend on it, but the union stays short + finite).
  const markerItems = HRT_MARKERS.map((m) => m.label);
  const unitItems = [...new Set(HRT_MARKERS.flatMap((m) => [m.canonicalUnit, ...m.units]))];
  for (let r = 2; r <= TEMPLATE_ROWS + 1; r += 1) {
    ws.getCell(r, 2).dataValidation = listValidation(markerItems);
    ws.getCell(r, 4).dataValidation = listValidation(unitItems);
    ws.getCell(r, 5).dataValidation = listValidation(CONTEXT_ITEMS);
  }

  buildAideSheet(wb.addWorksheet('Aide'));

  const blob = new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME });
  downloadBlob('Nodea — modèle import analyses HRT.xlsx', blob);
}
