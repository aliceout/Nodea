/**
 * HRT · Import — pure builders turning the « Analyses » rows pasted into
 * the .xlsx template back into the encrypted lab-results collection.
 *
 * Where it sits : the lib layer of the HRT module, the inbound mirror of
 * `export-model` / `csv`. **No I/O, no React, no xlsx library** — it takes
 * already-parsed cell rows (the `lib/xlsx` wrapper owns the file decoding)
 * and returns validated candidates, the distinct marker names to reconcile,
 * best-guess preset suggestions, the final payloads once a mapping is
 * chosen, and a dedupe pass against what already exists. That keeps every
 * fiddly rule (date / number / context coercion, fuzzy matching) testable
 * without a spreadsheet.
 *
 * Scope : **analyses only**. Doses (« prises ») are already entered through
 * the recurring/auto schedule mode, so they are out of the import — which
 * also removes the hard part : an analyse references a `marker` (a free
 * string), never a catalog product, so there is no entity to reconcile.
 *
 * Decisions baked in :
 * - **Markers are free strings.** Matching an imported marker to a preset
 *   is *optional* canonicalisation (a stable key + a default unit + target
 *   bands) ; an unmatched marker is simply kept verbatim.
 * - **Fail soft, per row.** A bad cell drops *that* row to the error list
 *   with a translated reason (the caller threads its `t`) ; the rest
 *   still import. Fully-blank rows are skipped silently (trailing
 *   template lines).
 * - **Dates / numbers are locale-tolerant.** ISO `YYYY-MM-DD`,
 *   `JJ.MM.AAAA` / `JJ/MM/AAAA`, an Excel serial, or a `Date` cell all land
 *   on ISO ; a French decimal comma (`0,4`) and thin thousands spaces are
 *   absorbed. The wrapper hands cells as strings / numbers ; `Date` is
 *   handled defensively (local parts).
 * - **`updatedAt` is stamped at creation**, not here — the builder leaves it
 *   `''` so this module stays pure (no clock).
 */
import {
  HRT_MARKERS,
  findMarker,
  type HrtDrawContext,
  type HrtLabResultPayload,
} from '@nodea/shared';

import { normalizeForSearch } from '@/lib/text-search';

import type { HrtTranslate } from './labels';

// ── Inbound cell shapes (filled by `lib/xlsx`) ──────────────────────────

/** A raw cell value as a spreadsheet parser hands it back. */
export type RawCell = string | number | boolean | Date | null | undefined;
/** One parsed data row, keyed by its verbatim column header. */
export type RawRow = Readonly<Record<string, RawCell>>;

// Accepted (already-normalised) header spellings per logical column.
// The template writes the localised headers (`hrt.import.template.headers`
// keys, FR or EN) ; this alias table is the read-side contract that keeps
// either spelling — plus case / accent variants — importable.
const ANALYSE_ALIASES = {
  date: ['date'],
  marker: ['marqueur', 'marker'],
  value: ['valeur', 'value'],
  unit: ['unite', 'unit'],
  context: ['contexte', 'context'],
  lab: ['laboratoire', 'laboratory', 'labo', 'lab'],
  notes: ['notes', 'note', 'remarques'],
} as const;

// ── Candidates + errors ─────────────────────────────────────────────────

export interface AnalyseCandidate {
  /** 1-based spreadsheet row (header = row 1) — for error messages. */
  row: number;
  date: string;
  /** Verbatim marker string ; mapped to a preset key (or kept) later. */
  marker: string;
  value: number;
  /** Verbatim unit ; may be '' (resolved from the preset at build time). */
  unit: string;
  context: HrtDrawContext;
  lab: string;
  notes: string;
}

export interface RowError {
  row: number;
  /** Human reason (already translated) shown in the dry-run preview. */
  reason: string;
}

export interface ParsedSheet<T> {
  candidates: T[];
  errors: RowError[];
}

// ── Cell coercion (private) ─────────────────────────────────────────────

/** Lowercased, accent- and edge-space-stripped — the comparison form used
 *  for headers, marker matching and context labels. */
function norm(s: string): string {
  return normalizeForSearch(s).trim();
}

/** First cell whose header matches one of `aliases` (normalised). */
function pick(row: RawRow, aliases: readonly string[]): RawCell {
  for (const key of Object.keys(row)) {
    if (aliases.includes(norm(key))) return row[key];
  }
  return undefined;
}

function asString(cell: RawCell): string {
  if (cell == null || cell instanceof Date) return '';
  return String(cell).trim();
}

/** A cell counts as blank only when truly empty — a `Date` is NOT blank. */
function isBlank(cell: RawCell): boolean {
  return cell == null || (typeof cell === 'string' && cell.trim() === '');
}

/** Build `YYYY-MM-DD`, rejecting impossible dates (e.g. 31.02) via a
 *  round-trip through `Date`. */
function isoFromParts(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}`;
}

/** ISO / `JJ.MM.AAAA` / `JJ/MM/AAAA` / Excel serial / `Date` -> ISO, or null. */
function normalizeDate(cell: RawCell): string | null {
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime())
      ? null
      : isoFromParts(cell.getFullYear(), cell.getMonth() + 1, cell.getDate());
  }
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    // Excel serial : days since 1899-12-30 (25569 = 1970-01-01).
    const dt = new Date(Math.round((cell - 25569) * 86400000));
    return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const s = asString(cell);
  if (s === '') return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return isoFromParts(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (m) return isoFromParts(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

/** A numeric cell, or a string with a French decimal comma / thin spaces. */
function normalizeNumber(cell: RawCell): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  const s = asString(cell);
  if (s === '') return null;
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const CONTEXT_BY_LABEL: ReadonlyMap<string, HrtDrawContext> = new Map([
  ['creux', 'trough'],
  ['trough', 'trough'],
  ['pic', 'peak'],
  ['peak', 'peak'],
  ['aleatoire', 'random'],
  ['random', 'random'],
  ['', 'unknown'],
  ['non precise', 'unknown'],
  ['inconnu', 'unknown'],
  ['unknown', 'unknown'],
]);

/** FR / EN draw-context label -> enum ; unknown spellings fall back lenient. */
function normalizeContext(cell: RawCell): HrtDrawContext {
  return CONTEXT_BY_LABEL.get(norm(asString(cell))) ?? 'unknown';
}

// ── Parsing ─────────────────────────────────────────────────────────────

/**
 * Validate the « Analyses » rows. `date` must resolve, `marker` be present
 * and `value` be a number ; `unit` may be '' (resolved from the preset at
 * build time). `context` is lenient. Fully-blank rows are skipped. Row
 * numbers assume the header is row 1.
 */
export function parseAnalyseRows(
  rows: readonly RawRow[],
  t: HrtTranslate,
): ParsedSheet<AnalyseCandidate> {
  const candidates: AnalyseCandidate[] = [];
  const errors: RowError[] = [];
  rows.forEach((row, i) => {
    const rowNum = i + 2;
    const rawDate = pick(row, ANALYSE_ALIASES.date);
    const rawMarker = pick(row, ANALYSE_ALIASES.marker);
    const rawValue = pick(row, ANALYSE_ALIASES.value);
    if (isBlank(rawDate) && isBlank(rawMarker) && isBlank(rawValue)) return;

    const date = normalizeDate(rawDate);
    const marker = asString(rawMarker);
    const value = normalizeNumber(rawValue);
    const problems: string[] = [];
    if (date === null) problems.push(t('hrt.import.errors.invalidDate'));
    if (marker === '') problems.push(t('hrt.import.errors.missingMarker'));
    if (value === null) problems.push(t('hrt.import.errors.invalidValue'));
    if (date === null || marker === '' || value === null) {
      errors.push({ row: rowNum, reason: problems.join(', ') });
      return;
    }
    candidates.push({
      row: rowNum,
      date,
      marker,
      value,
      unit: asString(pick(row, ANALYSE_ALIASES.unit)),
      context: normalizeContext(pick(row, ANALYSE_ALIASES.context)),
      lab: asString(pick(row, ANALYSE_ALIASES.lab)),
      notes: asString(pick(row, ANALYSE_ALIASES.notes)),
    });
  });
  return { candidates, errors };
}

// ── Reconciliation suggestions ──────────────────────────────────────────

/** Distinct verbatim marker strings across the analyses, alpha-sorted. */
export function distinctMarkerNames(candidates: readonly AnalyseCandidate[]): string[] {
  return [...new Set(candidates.map((c) => c.marker))].sort((a, b) => a.localeCompare(b));
}

export interface MarkerSuggestion {
  /** Preset key to store. */
  key: string;
  label: string;
  canonicalUnit: string;
}

/**
 * Best preset-marker guess for an imported marker string : exact match on
 * the preset key or label, else a label that contains the imported text.
 * null -> keep the imported string as a free-text custom marker.
 */
export function suggestMarkerMatch(name: string): MarkerSuggestion | null {
  const target = norm(name);
  if (target === '') return null;
  const hit =
    HRT_MARKERS.find((m) => norm(m.key) === target || norm(m.label) === target) ??
    HRT_MARKERS.find((m) => norm(m.label).includes(target));
  return hit ? { key: hit.key, label: hit.label, canonicalUnit: hit.canonicalUnit } : null;
}

// ── Payload building (after the mapping is chosen) ──────────────────────

/** Imported marker string -> marker key to store (the verbatim string if kept). */
export type MarkerMapping = ReadonlyMap<string, string>;

export interface SkippedRow {
  row: number;
  reason: string;
}

export interface BuiltLabResults {
  payloads: HrtLabResultPayload[];
  skipped: SkippedRow[];
}

/**
 * Turn analyse candidates into payloads using a chosen marker mapping
 * (defaults to the verbatim string). An empty unit is filled from the
 * mapped preset's canonical unit ; a still-empty unit skips the row (the
 * schema requires a unit). `updatedAt` is left '' (the import hook stamps
 * it at creation).
 */
export function buildLabResultPayloads(
  candidates: readonly AnalyseCandidate[],
  mapping: MarkerMapping,
  t: HrtTranslate,
): BuiltLabResults {
  const payloads: HrtLabResultPayload[] = [];
  const skipped: SkippedRow[] = [];
  for (const c of candidates) {
    const marker = mapping.get(c.marker) ?? c.marker;
    const unit = c.unit !== '' ? c.unit : (findMarker(marker)?.canonicalUnit ?? '');
    if (unit === '') {
      skipped.push({
        row: c.row,
        reason: t('hrt.import.errors.missingUnit', { values: { marker } }),
      });
      continue;
    }
    payloads.push({
      date: c.date,
      marker,
      value: c.value,
      unit,
      context: c.context,
      lab: c.lab,
      notes: c.notes,
      updatedAt: '',
    });
  }
  return { payloads, skipped };
}

// ── Dedupe against what already exists ──────────────────────────────────

export interface DedupeResult<T> {
  /** Rows not seen before (also de-duplicated within the batch itself). */
  fresh: T[];
  /** Rows that exactly match an existing entry (or an earlier batch row). */
  duplicates: T[];
}

function labKey(p: HrtLabResultPayload): string {
  return [p.date, p.marker, p.value, p.unit, p.context, p.lab, p.notes].join('\t');
}

/**
 * Drop analyses that exactly match an existing reading (all fields but
 * `updatedAt`), so re-importing the same file is safe. Also de-duplicates
 * within the imported batch.
 */
export function dedupeLabResults(
  payloads: readonly HrtLabResultPayload[],
  existing: readonly HrtLabResultPayload[],
): DedupeResult<HrtLabResultPayload> {
  const seen = new Set(existing.map(labKey));
  const fresh: HrtLabResultPayload[] = [];
  const duplicates: HrtLabResultPayload[] = [];
  for (const p of payloads) {
    const k = labKey(p);
    if (seen.has(k)) {
      duplicates.push(p);
      continue;
    }
    seen.add(k);
    fresh.push(p);
  }
  return { fresh, duplicates };
}
