/**
 * Journal · single-entry PDF export (jsPDF), built from the decrypted entry.
 *
 * Triggered from the entry reader (`ReaderShell` → `EntryReader` topbar
 * extras) — ONE entry per file, laid out as an editorial page in the
 * K · Sauge charte : sage eyebrow (the thread), ink headline (title, or the
 * date when the entry is untitled), the Markdown body, then the attached
 * photos embedded full-width, and a discreet « Nodea » footer.
 *
 * The body is the SAME lightweight Markdown subset `LiteMarkdown` renders on
 * screen — `**bold**`, `*italic*`, `- ` bullets, `>` quotes — re-implemented
 * with jsPDF run layout so what prints matches what the reader shows (no raw
 * `**` markers leaking through). Headings / links are deliberately unsupported
 * on both sides, so they stay literal here too.
 *
 * Client-side by necessity : the entry is decrypted plaintext (+ inline
 * photos), so it must never reach the server — no headless render. jsPDF is
 * **dynamically imported** so it stays out of the main bundle until an export.
 *
 * Colours are the light-theme brand tokens from `ui/theme/dirk.css`
 * (`--color-k-*`) transcribed to RGB — a PDF is a light paper surface.
 *
 * NB : jsPDF's standard Helvetica is WinAnsi-encoded — it covers French
 * accents but NOT emoji / non-Latin scripts (they render blank). Download uses
 * our own anchor, never `doc.save()` (a reload would drop the in-memory main
 * key and log the user out — same rationale as the HRT export).
 */
import { splitThreads } from '@nodea/shared';

import { intlLocale, parseLocalDate } from '@/core/i18n/date-format';

type RGB = readonly [number, number, number];
// Light-theme K · Sauge tokens (dirk.css `--color-k-*`).
const INK: RGB = [22, 22, 20]; // --color-k-ink
const INK_SOFT: RGB = [58, 58, 54]; // --color-k-ink-soft
const MUTED: RGB = [136, 133, 124]; // --color-k-muted
const HAIR: RGB = [231, 229, 221]; // --color-k-hair
const ACCENT: RGB = [90, 122, 94]; // --color-k-accent
const ACCENT_DEEP: RGB = [61, 86, 65]; // --color-k-accent-deep

const M = 20; // page margin (mm)
const FOOTER_H = 14; // reserved band at the bottom of every page
const BODY = 11; // body font size (pt)
const LH = 6; // body line height (mm)
const INDENT = 6; // bullet / quote left indent (mm)

type InlineStyle = 'normal' | 'bold' | 'italic';
interface Run {
  text: string;
  style: InlineStyle;
}

type Translate = (key: string, opts?: { values?: Record<string, string | number> }) => string;

/** Structural subset of a journal entry this exporter reads. */
export interface JournalEntryPdfInput {
  /** ISO `YYYY-MM-DD` or full ISO datetime — only the date part is used. */
  dateIso: string;
  thread: string;
  title: string | null;
  content: string;
  /** Always JPEG in the current pipeline (`imageResize`). */
  attachments: ReadonlyArray<{ mime: string; data: string }>;
}

export interface JournalEntryPdfArgs {
  entry: JournalEntryPdfInput;
  filename: string;
  /** Caller's `useI18n()` translator — the document is user-facing. */
  t: Translate;
  /** Active app language (`useI18n().language`) for date formatting. */
  language: string;
}

/** Capitalise the first letter — `Intl` lowercases the French weekday. */
function capitalize(s: string): string {
  return s.length > 0 ? `${s[0]!.toUpperCase()}${s.slice(1)}` : s;
}

/**
 * Tokenise a line into bold / italic / plain runs — the SAME greedy grammar
 * as `LiteMarkdown.renderInline` (`**…**` first, then `*…*`, no nesting).
 */
function tokenizeInline(line: string): Run[] {
  const runs: Run[] = [];
  const regex = /\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(line)) !== null) {
    if (m.index > last) runs.push({ text: line.slice(last, m.index), style: 'normal' });
    if (m[1] !== undefined) runs.push({ text: m[1], style: 'bold' });
    else if (m[2] !== undefined) runs.push({ text: m[2], style: 'italic' });
    last = regex.lastIndex;
  }
  if (last < line.length) runs.push({ text: line.slice(last), style: 'normal' });
  return runs;
}

export async function downloadJournalEntryPdf(args: JournalEntryPdfArgs): Promise<void> {
  const { entry, t, language } = args;
  const locale = intlLocale(language);
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - 2 * M;
  const contentBottom = pageH - M - FOOTER_H;

  const longDate = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dateLabel = capitalize(longDate.format(parseLocalDate(entry.dateIso.slice(0, 10))));

  /** Slim sage brand tick at the top-left of a page; returns the first
   *  usable content baseline below it. */
  const topTick = (): number => {
    doc.setFillColor(...ACCENT);
    doc.rect(M, M, 14, 1.4, 'F');
    return M + 9;
  };

  /**
   * Lay out styled runs with word wrapping + pagination, switching the jsPDF
   * font per run so bold / italic actually render (no `**` markers). When
   * `justify` is set, every line but the last spreads its slack across the
   * word gaps to fill the column — mirrors `LiteMarkdown`'s `text-justify`.
   * Returns the cursor below the last drawn line.
   */
  const renderRuns = (
    runs: Run[],
    x0: number,
    yIn: number,
    maxW: number,
    color: RGB,
    justify: boolean,
  ): number => {
    doc.setFontSize(BODY);
    doc.setTextColor(...color);
    const styleFont = (s: InlineStyle): void => {
      doc.setFont('helvetica', s === 'normal' ? 'normal' : s);
    };

    // Flatten the runs into measured words (over-long tokens hard-split so
    // they never overflow the column).
    const words: Array<{ text: string; style: InlineStyle; width: number }> = [];
    for (const run of runs) {
      if (!run.text) continue;
      styleFont(run.style);
      for (const tok of run.text.split(/\s+/)) {
        if (tok === '') continue;
        const width = doc.getTextWidth(tok);
        if (width > maxW) {
          for (const piece of doc.splitTextToSize(tok, maxW) as string[]) {
            words.push({ text: piece, style: run.style, width: doc.getTextWidth(piece) });
          }
        } else {
          words.push({ text: tok, style: run.style, width });
        }
      }
    }
    doc.setFont('helvetica', 'normal');
    const spaceW = doc.getTextWidth(' ');

    // Greedy line breaking on the natural single-space width.
    const lines: Array<Array<{ text: string; style: InlineStyle; width: number }>> = [];
    let line: typeof words = [];
    let lineW = 0;
    for (const w of words) {
      const add = (line.length === 0 ? 0 : spaceW) + w.width;
      if (line.length > 0 && lineW + add > maxW) {
        lines.push(line);
        line = [w];
        lineW = w.width;
      } else {
        line.push(w);
        lineW += add;
      }
    }
    if (line.length > 0) lines.push(line);

    let y = yIn;
    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li]!;
      if (y + LH > contentBottom) {
        doc.addPage();
        y = topTick();
        doc.setFontSize(BODY);
        doc.setTextColor(...color);
      }
      const isLast = li === lines.length - 1;
      const wordsW = ln.reduce((s, w) => s + w.width, 0);
      // Justified inner lines spread slack across the gaps; the last line
      // (and single-word lines) keep the natural single space.
      const gap =
        justify && !isLast && ln.length > 1 ? (maxW - wordsW) / (ln.length - 1) : spaceW;
      let x = x0;
      for (const w of ln) {
        styleFont(w.style);
        doc.text(w.text, x, y);
        x += w.width + gap;
      }
      y += LH;
    }
    return y;
  };

  /** Render the body — mirrors `LiteMarkdown`'s block grouping. */
  const renderMarkdown = (text: string, yIn: number): number => {
    let y = yIn;
    let list: string[] = [];
    let quote: string[] = [];

    const flushList = (): void => {
      if (list.length === 0) return;
      for (const item of list) {
        if (y + LH > contentBottom) { doc.addPage(); y = topTick(); }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(BODY);
        doc.setTextColor(...INK_SOFT);
        doc.text('•', M + 1, y);
        y = renderRuns(tokenizeInline(item), M + INDENT, y, contentW - INDENT, INK_SOFT, true);
      }
      y += 2;
      list = [];
    };

    const flushQuote = (): void => {
      if (quote.length === 0) return;
      const startPage = doc.getNumberOfPages();
      const startY = y;
      for (const q of quote) {
        // Inside a quote everything is italic (bold stays bold) — matches the
        // reader's italic blockquote; this also strips the `*` markers.
        const runs = tokenizeInline(q).map<Run>((r) => ({
          text: r.text,
          style: r.style === 'bold' ? 'bold' : 'italic',
        }));
        y = renderRuns(runs, M + INDENT, y, contentW - INDENT, INK_SOFT, false);
      }
      // Sage left rule — drawn only when the block stayed on one page (a rare
      // page-spanning quote simply loses the rule; not worth the complexity).
      if (doc.getNumberOfPages() === startPage) {
        doc.setDrawColor(...ACCENT);
        doc.setLineWidth(0.7);
        doc.line(M + 1.5, startY - 3.4, M + 1.5, y - LH + 1.4);
      }
      y += 2;
      quote = [];
    };

    for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
      if (raw.startsWith('- ')) {
        flushQuote();
        list.push(raw.slice(2));
      } else if (raw.startsWith('>')) {
        flushList();
        quote.push(raw.replace(/^>\s?/, ''));
      } else {
        flushList();
        flushQuote();
        if (raw.trim() === '') y += LH * 0.55;
        else y = renderRuns(tokenizeInline(raw), M, y, contentW, INK_SOFT, true);
      }
    }
    flushList();
    flushQuote();
    return y;
  };

  // ── Header ──────────────────────────────────────────────────────────
  let y = topTick();

  // Eyebrow — the thread, uppercased, tracked out, in deep sage.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...ACCENT_DEEP);
  // One thread per « chip », visually separated by a mid-dot — mirrors the
  // reader header where each thread is its own tag.
  const threads = splitThreads(entry.thread);
  const eyebrow = (
    threads.length > 0 ? threads.join('   ·   ') : t('journal.export.pdf.noThread')
  ).toUpperCase();
  doc.text(eyebrow, M, y, { charSpace: 0.6 });
  y += 8;

  // Headline — the title, or the date itself when the entry is untitled.
  if (entry.title && entry.title.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...INK);
    for (const line of doc.splitTextToSize(entry.title.trim(), contentW) as string[]) {
      doc.text(line, M, y);
      y += 9;
    }
    y += 1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    doc.text(dateLabel, M, y);
    y += 5;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...INK);
    doc.text(dateLabel, M, y);
    y += 6;
  }

  // Hairline under the header.
  y += 2;
  doc.setDrawColor(...HAIR);
  doc.setLineWidth(0.3);
  doc.line(M, y, pageW - M, y);
  y += 8;

  // ── Body (Markdown subset) ──────────────────────────────────────────
  if (entry.content.trim()) {
    y = renderMarkdown(entry.content, y);
  }

  // ── Attachments — embedded full-width, each in a hairline frame ──────
  for (const att of entry.attachments) {
    const src = `data:${att.mime};base64,${att.data}`;
    let props: { width: number; height: number };
    try {
      props = doc.getImageProperties(src);
    } catch {
      // Unreadable / unsupported image — skip it rather than abort the export.
      continue;
    }
    const ratio = props.height / props.width || 1;
    let w = contentW;
    let h = w * ratio;
    const maxH = contentBottom - M; // tallest an image can be on a fresh page
    if (h > maxH) {
      h = maxH;
      w = h / ratio;
    }
    if (y + 4 + h > contentBottom) { doc.addPage(); y = topTick(); }
    else y += 4;
    const x = M + (contentW - w) / 2; // centre when narrower than the column
    try {
      doc.addImage(src, 'JPEG', x, y, w, h);
    } catch {
      continue;
    }
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, h);
    y += h + 4;
  }

  // ── Footer on every page — discreet Nodea wordmark (+ page numbers) ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const fy = pageH - M + 2;
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.2);
    doc.line(M, fy - 4, pageW - M, fy - 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...ACCENT_DEEP);
    doc.text('Nodea', M, fy, { charSpace: 0.4 });
    if (pageCount > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(`${i} / ${pageCount}`, pageW - M, fy, { align: 'right' });
    }
  }

  const url = URL.createObjectURL(doc.output('blob'));
  const a = document.createElement('a');
  a.href = url;
  a.download = args.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
