/**
 * HRT · Export — direct PDF download (jsPDF), built from the model data.
 *
 * Why client-side + from data (not a DOM capture / server render) : the
 * recap holds decrypted health data, so it must never reach the server —
 * no headless-Chrome PDF. And the browser can't silently « save as PDF »
 * from `window.print()` (the dialog is unavoidable). So we generate the
 * file here : crisp, selectable tables via jsPDF-AutoTable, charts drawn
 * with jsPDF primitives, portrait data then one chart per landscape page.
 *
 * jsPDF + the autotable plugin are **dynamically imported** so they stay
 * out of the main bundle until the user actually exports.
 *
 * NB : jsPDF's standard fonts use WinAnsi encoding (covers é/è/à/ç/œ/µ/— )
 * but NOT « ≈ » — so dose strings here use « (N mg) », never the ≈ form.
 */
import type { DoseChart, DoseRow, ExportGroupBy, LabGroup, RegimenRow } from './export-model';
import { flattenLabReadings, groupDosesByMolecule } from './export-model';
import { formatDotDate, type HrtTranslate, type HrtTranslatePlural } from './labels';
import type { ChartPoint } from '../components/LabChart';

type RGB = readonly [number, number, number];
const INK: RGB = [45, 58, 45];
const MUTED: RGB = [120, 117, 108];
const HAIR: RGB = [205, 202, 192];
const ACCENT: RGB = [122, 154, 126];
const HEADER_BG: RGB = [240, 239, 233];

const M = 14; // portrait page margin (mm)

export interface ExportPdfArgs {
  generatedLabel: string;
  periodLabel: string;
  note: string;
  groupBy: ExportGroupBy;
  regimen: ReadonlyArray<RegimenRow>;
  doses: ReadonlyArray<DoseRow>;
  labs: ReadonlyArray<LabGroup>;
  doseCharts: ReadonlyArray<DoseChart>;
  filename: string;
  /** Caller's `useI18n()` translators — the report is a user-facing
   *  document, so every string in it goes through them. */
  t: HrtTranslate;
  tn: HrtTranslatePlural;
  /** BCP-47 language for the chart date labels (`useI18n().language`). */
  locale: string;
}

/** Human dose string for the PDF — « 0.4 mL (4 mg) » (no « ≈ »). */
function doseText(dose: number, unit: string, mgEq: number | null): string {
  return `${dose}${unit ? ` ${unit}` : ''}${mgEq != null ? ` (${mgEq} mg)` : ''}`;
}

/** Product cell for the dose table — the product name, with the molecule +
 *  concentration recalled underneath (multi-line). */
function doseProductCell(r: DoseRow): string {
  const detail = [
    r.molecule !== r.product ? r.molecule : null,
    typeof r.concentration === 'number' ? `${r.concentration} mg/mL` : null,
  ].filter((s): s is string => s !== null);
  return detail.length ? `${r.product}\n${detail.join(' · ')}` : r.product;
}

export async function downloadExportPdf(args: ExportPdfArgs): Promise<void> {
  const { t, tn, locale } = args;
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  /** Y after the last table. */
  const tableEndY = (): number => {
    const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    return last ? last.finalY : M;
  };
  /** Add a page if `need` mm won't fit below `y`. */
  const ensure = (y: number, need: number): number =>
    y + need > pageH - M ? (doc.addPage(), M) : y;

  const sectionTitle = (text: string, yIn: number, meta?: string): number => {
    let y = ensure(yIn, 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(text, M, y);
    if (meta) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(meta, pageW - M, y, { align: 'right' });
    }
    y += 1.5;
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.2);
    doc.line(M, y, pageW - M, y);
    return y + 4;
  };

  const subHeading = (text: string, yIn: number): number => {
    const y = ensure(yIn, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(text, M, y);
    return y + 1.5;
  };

  const muted = (text: string, y: number): number => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(text, M, y);
    return y + 6;
  };

  const table = (
    head: string[],
    body: (string | number)[][],
    startY: number,
    ratios?: number[],
  ): number => {
    // Column widths from `ratios` (defaults to equal) — split the content
    // width by share ; content wraps within each cell.
    const avail = pageW - 2 * M;
    const shares = ratios ?? head.map(() => 1);
    const total = shares.reduce((a, b) => a + b, 0);
    const columnStyles: Record<number, { cellWidth: number }> = {};
    shares.forEach((share, i) => {
      columnStyles[i] = { cellWidth: (share / total) * avail };
    });
    autoTable(doc, {
      head: [head],
      body,
      startY,
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.4, textColor: [...INK], lineColor: [...HAIR], lineWidth: 0.1 },
      headStyles: { fillColor: [...HEADER_BG], textColor: [...MUTED], fontStyle: 'bold', fontSize: 7 },
      columnStyles,
    });
    return tableEndY() + 7;
  };

  /** Render each chart on its own fresh landscape page. */
  const drawChartPages = (
    list: ReadonlyArray<{ points: ReadonlyArray<ChartPoint>; unit: string; label: string }>,
  ): void => {
    for (const c of list) {
      doc.addPage('a4', 'landscape');
      const lw = doc.internal.pageSize.getWidth();
      const lh = doc.internal.pageSize.getHeight();
      drawChart(doc, c.points, c.unit, c.label, { x: 12, y: 12, w: lw - 24, h: lh - 24 }, locale);
    }
  };

  // ── Header ──────────────────────────────────────────────────────────
  let y = M + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(t('hrt.export.pdf.title'), M, y);
  y += 7;
  if (args.note.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(args.note.trim(), M, y);
    y += 6;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    t('hrt.export.pdf.meta', { values: { date: args.generatedLabel, period: args.periodLabel } }),
    M,
    y,
  );
  y += 6;

  // ── Current treatment ───────────────────────────────────────────────
  y = sectionTitle(
    t('hrt.export.pdf.regimenTitle'),
    y,
    args.regimen.length ? tn('hrt.export.pdf.regimenCount', args.regimen.length) : undefined,
  );
  if (args.regimen.length === 0) {
    y = muted(t('hrt.export.pdf.regimenEmpty'), y);
  } else {
    y = table(
      ['molecule', 'dose', 'frequency', 'route', 'since'].map((k) =>
        t(`hrt.export.pdf.regimenHead.${k}`),
      ),
      args.regimen.map((r) => [
        r.product !== r.molecule ? `${r.molecule} (${r.product})` : r.molecule,
        r.doseText.replace(/\s*≈\s*/, ' = '),
        r.cadence,
        r.routeLabel || '—',
        formatDotDate(r.startDate),
      ]),
      y,
    );
  }

  // ── Intake history ──────────────────────────────────────────────────
  const doseHead = ['date', 'product', 'dose', 'route'].map((k) => t(`hrt.export.matrix.${k}`));
  y = sectionTitle(
    t('hrt.export.pdf.dosesTitle'),
    y,
    args.doses.length ? tn('hrt.export.pdf.doseCount', args.doses.length) : undefined,
  );
  if (args.doses.length === 0) {
    y = muted(t('hrt.export.pdf.dosesEmpty'), y);
  } else if (args.groupBy === 'type') {
    for (const g of groupDosesByMolecule(args.doses)) {
      y = subHeading(`${g.molecule} · ${tn('hrt.export.pdf.doseCount', g.rows.length)}`, y);
      y = table(
        doseHead,
        g.rows.map((r) => [
          formatDotDate(r.date),
          doseProductCell(r),
          doseText(r.dose, r.unit, r.mgEq),
          r.routeLabel || '—',
        ]),
        y,
        [0.5, 1.5, 1, 1],
      );
    }
  } else {
    y = table(
      doseHead,
      args.doses.map((r) => [
        formatDotDate(r.date),
        doseProductCell(r),
        doseText(r.dose, r.unit, r.mgEq),
        r.routeLabel || '—',
      ]),
      y,
      [0.5, 1.5, 1, 1],
    );
  }

  // Administration charts (mg-equivalent dose trends) — placed here, before
  // the analyses, so they sit with the administration data.
  drawChartPages(
    args.doseCharts
      .filter((c) => c.points.length >= 2)
      .map((c) => ({
        points: c.points,
        unit: 'mg',
        label: t('hrt.export.pdf.doseChartLabel', { values: { molecule: c.molecule } }),
      })),
  );

  // ── Lab results — always start at the top of a fresh page ───────────
  doc.addPage('a4', 'portrait');
  y = M + 2;
  const totalLabs = args.labs.reduce((n, g) => n + g.readings.length, 0);
  y = sectionTitle(
    t('hrt.export.pdf.labsTitle'),
    y,
    totalLabs ? tn('hrt.export.pdf.labCount', totalLabs) : undefined,
  );
  if (args.labs.length === 0) {
    y = muted(t('hrt.export.pdf.labsEmpty'), y);
  } else if (args.groupBy === 'type') {
    for (const g of args.labs) {
      y = subHeading(`${g.label} (${g.displayUnit})`, y);
      y = table(
        ['date', 'value', 'context', 'lab'].map((k) => t(`hrt.export.matrix.${k}`)),
        g.readings.map((r) => [formatDotDate(r.date), `${r.value} ${r.unit}`, r.contextLabel || '—', r.lab || '—']),
        y,
      );
    }
  } else {
    y = table(
      ['date', 'marker', 'value', 'context', 'lab'].map((k) => t(`hrt.export.matrix.${k}`)),
      flattenLabReadings(args.labs).map((r) => [
        formatDotDate(r.date),
        r.markerLabel,
        `${r.value} ${r.unit}`,
        r.contextLabel || '—',
        r.lab || '—',
      ]),
      y,
    );
  }

  // ── Disclaimer ──────────────────────────────────────────────────────
  y = ensure(y, 18);
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.2);
  doc.line(M, y, pageW - M, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(doc.splitTextToSize(t('hrt.export.pdf.disclaimer'), pageW - 2 * M), M, y);

  // Analyses charts (marker trends) — after the analyses tables.
  drawChartPages(
    args.labs
      .filter((g) => g.points.length >= 2)
      .map((g) => ({ points: g.points, unit: g.displayUnit, label: g.label })),
  );

  // Download via OUR own anchor — NOT `doc.save()`. jsPDF's bundled saver
  // can navigate the window in some bundler setups ; a full reload here
  // would drop the in-memory main key and log the user out. Same Blob +
  // temporary-anchor technique as the CSV download (which never reloads).
  const url = URL.createObjectURL(doc.output('blob'));
  const a = document.createElement('a');
  a.href = url;
  a.download = args.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ── Chart drawing (a clean line chart in jsPDF primitives) ────────────

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function dateMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime();
}
function fmtVal(v: number): string {
  return Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}
function fmtDate(ms: number, locale: string): string {
  return new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function drawChart(
  doc: import('jspdf').jsPDF,
  points: ReadonlyArray<ChartPoint>,
  unit: string,
  label: string,
  box: Box,
  locale: string,
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(`${label} (${unit})`, box.x, box.y + 4);

  const pad = { l: 18, r: 6, t: 10, b: 12 };
  const px = box.x + pad.l;
  const py = box.y + pad.t;
  const pw = box.w - pad.l - pad.r;
  const ph = box.h - pad.t - pad.b;

  const times = points.map((p) => dateMs(p.dateIso));
  const values = points.map((p) => p.value);
  const xMin = Math.min(...times);
  const xMax = Math.max(...times);
  const vMinD = Math.min(...values);
  const vMaxD = Math.max(...values);
  const span = vMaxD - vMinD;
  const padV = span === 0 ? Math.abs(vMaxD) * 0.1 || 1 : span * 0.14;
  const vMin = vMinD - padV;
  const vMax = vMaxD + padV;

  const sx = (t: number): number =>
    points.length === 1 ? px + pw / 2 : px + ((t - xMin) / (xMax - xMin || 1)) * pw;
  const sy = (v: number): number => py + (1 - (v - vMin) / (vMax - vMin || 1)) * ph;

  // Y gridlines + value labels.
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.1);
  const Y_TICKS = 4;
  for (let i = 0; i < Y_TICKS; i++) {
    const v = vMaxD - (i * (vMaxD - vMinD)) / (Y_TICKS - 1);
    const yy = sy(v);
    doc.line(px, yy, px + pw, yy);
    doc.text(fmtVal(v), px - 2, yy + 1, { align: 'right' });
  }

  // X date labels.
  const n = points.length === 1 ? 1 : Math.min(points.length, Math.max(2, Math.floor(pw / 40)));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? xMin : xMin + (i * (xMax - xMin)) / (n - 1);
    doc.text(fmtDate(t, locale), sx(t), py + ph + 5, {
      align: i === 0 ? 'left' : i === n - 1 ? 'right' : 'center',
    });
  }

  // Plot frame.
  doc.rect(px, py, pw, ph);

  // Line + points.
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.5);
  for (let i = 1; i < points.length; i++) {
    doc.line(sx(times[i - 1] ?? 0), sy(values[i - 1] ?? 0), sx(times[i] ?? 0), sy(values[i] ?? 0));
  }
  doc.setFillColor(...ACCENT);
  points.forEach((p, i) => {
    doc.circle(sx(times[i] ?? 0), sy(p.value), 0.9, 'F');
  });
}
