/**
 * HRT · Export — write a row matrix to the spreadsheet format the user
 * picked (Excel `.xlsx` or LibreOffice `.ods`) and download it.
 *
 * Where it sits : the data-export sibling of `export-pdf` (the doctor PDF)
 * and `xlsx` (the import side). The pure row matrices come from
 * `export-model` ; this file owns only the format encoding + the download.
 *
 * Two formats, two engines, both **lazy-imported** so they stay off the main
 * bundle (like jsPDF / exceljs for the import) :
 *   - `.xlsx` → exceljs (already in the stack for the import template).
 *   - `.ods`  → hand-rolled OpenDocument (a zip of a stored `mimetype` +
 *     `content.xml` + `META-INF/manifest.xml`), zipped with fflate. No JS
 *     lib writes both `.xlsx` and `.ods`, and the data is plain tabular
 *     (strings + numbers, no styling), so the open format is built directly.
 *
 * Client-side only : decrypted health data, never sent to a server.
 */
export type SpreadsheetFormat = 'xlsx' | 'ods';

type Matrix = ReadonlyArray<ReadonlyArray<string | number>>;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet';

/**
 * Build + download `matrix` (row 0 = header) as `baseName.<ext>` in the
 * chosen format. The engine is lazy-loaded on first use.
 */
export async function downloadSpreadsheet(
  baseName: string,
  sheetName: string,
  matrix: Matrix,
  format: SpreadsheetFormat,
): Promise<void> {
  const blob = format === 'ods' ? await toOds(sheetName, matrix) : await toXlsx(sheetName, matrix);
  downloadBlob(`${baseName}.${format}`, blob);
}

// ── .xlsx (exceljs) ─────────────────────────────────────────────────────

async function toXlsx(sheetName: string, matrix: Matrix): Promise<Blob> {
  const { Workbook } = await import('exceljs');
  const wb = new Workbook();
  wb.creator = 'Nodea';
  const ws = wb.addWorksheet(sheetName);
  matrix.forEach((row, i) => {
    const added = ws.addRow([...row]);
    if (i === 0) {
      added.eachCell((cell) => {
        cell.font = { bold: true };
      });
    }
  });
  return new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME });
}

// ── .ods (hand-rolled OpenDocument + fflate) ────────────────────────────

function xmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;',
  );
}

function odsCell(value: string | number): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return (
      `<table:table-cell office:value-type="float" office:value="${value}">` +
      `<text:p>${value}</text:p></table:table-cell>`
    );
  }
  return (
    '<table:table-cell office:value-type="string">' +
    `<text:p>${xmlEscape(String(value))}</text:p></table:table-cell>`
  );
}

function odsContent(sheetName: string, matrix: Matrix): string {
  const rows = matrix
    .map((row) => `<table:table-row>${row.map(odsCell).join('')}</table:table-row>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<office:document-content' +
    ' xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"' +
    ' xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"' +
    ' xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"' +
    ' office:version="1.3">' +
    '<office:body><office:spreadsheet>' +
    `<table:table table:name="${xmlEscape(sheetName)}">${rows}</table:table>` +
    '</office:spreadsheet></office:body></office:document-content>'
  );
}

const ODS_MANIFEST =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<manifest:manifest' +
  ' xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"' +
  ' manifest:version="1.3">' +
  `<manifest:file-entry manifest:full-path="/" manifest:media-type="${ODS_MIME}"/>` +
  '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
  '</manifest:manifest>';

async function toOds(sheetName: string, matrix: Matrix): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate');
  // `mimetype` must be the first entry and stored uncompressed (level 0) per
  // the OpenDocument spec ; the rest are deflated normally.
  const zip = zipSync(
    {
      mimetype: [strToU8(ODS_MIME), { level: 0 }],
      'content.xml': strToU8(odsContent(sheetName, matrix)),
      'META-INF/manifest.xml': strToU8(ODS_MANIFEST),
    },
    { level: 6 },
  );
  return new Blob([zip], { type: ODS_MIME });
}

// ── download ────────────────────────────────────────────────────────────

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
