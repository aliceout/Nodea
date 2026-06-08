/**
 * HRT · Export — minimal RFC 4180 CSV serialiser + a browser file save.
 *
 * Why local & hand-rolled : the only CSV producer in the app is the HRT
 * doctor export, and pulling a dependency for « join with commas, quote
 * the awkward fields » fails the CLAUDE.md « prefer stdlib » bar. Kept
 * domain-free (it takes a matrix of strings/numbers) so the export model
 * owns the column shaping and this file owns only the mechanics.
 *
 * Decisions baked in : comma delimiter + CRLF line endings (RFC 4180), a
 * field is quoted only when it contains a quote / delimiter / newline
 * (with `"` doubled), and the output is prefixed with a UTF-8 BOM so
 * Excel reads the accented molecule / marker names (é, µ…) correctly.
 */

const DELIMITER = ',';
const NEWLINE = '\r\n';
const BOM = '﻿';

/** Quote a single field iff it contains a quote, the delimiter, or a
 *  line break ; double any embedded quote. */
function escapeField(value: string | number): string {
  const s = String(value);
  return /["\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialise a row matrix (first row = header) to a CSV string with a
 *  UTF-8 BOM. Each inner array is one record. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  return BOM + rows.map((row) => row.map(escapeField).join(DELIMITER)).join(NEWLINE);
}

/**
 * Save `content` as a download named `filename`. Same Blob + temporary
 * anchor technique the account-data export and the TOTP backup codes use
 * — everything stays client-side, nothing is sent to the server.
 */
export function downloadTextFile(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
