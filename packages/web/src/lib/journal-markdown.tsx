import type { ReactNode } from 'react';

/**
 * Render a journal entry's plain-text content with the lightweight
 * Markdown subset that the Composer's `MarkdownEditor` produces:
 * `**bold**`, `*italic*`, `- bullet` lines. Newlines that aren't
 * part of a list keep their breaks via `whitespace-pre-wrap`.
 *
 * Type sized to match Mood's entry rows (`text-[13px] leading-[1.5]`,
 * sans-serif) so the modules feel like one app rather than two.
 *
 * Kept tiny on purpose — no headings, no links, no nesting beyond
 * inline-on-line. A real Markdown renderer would pull in `react-
 * markdown` + `remark-gfm` for ~30 KB; the journal only needs three
 * shapes, so a 40-line walker stays in source. Used both by the
 * Journal page (for saved entries) and by the Composer's preview
 * toggle (so what you see while writing is exactly what gets
 * rendered after save).
 */
export function JournalContent({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split('\n');
  let listBuffer: string[] = [];
  let key = 0;

  function flushList() {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={key++} className="my-1 list-disc space-y-0.5 pl-5">
        {listBuffer.map((item, i) => (
          <li
            key={i}
            className="text-justify text-[13px] leading-[1.5] text-ink hyphens-auto"
          >
            {renderInline(item)}
          </li>
        ))}
      </ul>,
    );
    listBuffer = [];
  }

  for (const line of lines) {
    if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2));
    } else {
      flushList();
      blocks.push(
        <p
          key={key++}
          className="min-h-[1lh] whitespace-pre-wrap text-justify text-[13px] leading-[1.5] text-ink hyphens-auto"
        >
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushList();

  return (
    <div lang="fr" className="space-y-0.5">
      {blocks}
    </div>
  );
}

/**
 * Tokenise a single line into bold / italic / plain runs. Greedy
 * matches `**…**` first, then `*…*`. Doesn't try to handle nesting
 * (intentional — see `JournalContent`).
 */
function renderInline(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const regex = /\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      out.push(line.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      out.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      out.push(<em key={key++}>{match[2]}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < line.length) {
    out.push(line.slice(lastIndex));
  }
  return out;
}

/**
 * Convert the lightweight Markdown subset (`**bold**`, `*italic*`,
 * `- bullet`) to a small HTML string suitable for a `contentEditable`
 * surface. Used by the Composer's visual edit mode to rehydrate the
 * editor from the canonical Markdown storage on mount and on toggle.
 *
 * Plaintext runs are escaped so user content can't smuggle stray
 * tags into the editor surface — the only HTML elements that come
 * out are `<strong>`, `<em>`, `<ul>`, `<li>`, `<div>`, `<br>`.
 */
export function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;

  function closeList() {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  }

  for (const line of lines) {
    if (line.startsWith('- ')) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineMdToHtml(line.slice(2))}</li>`);
    } else {
      closeList();
      // contentEditable expects each visible line as its own block
      // wrapper (Chrome creates `<div>` per line, Firefox uses `<br>`
      // — we use `<div>` which both browsers accept and edit cleanly).
      // Empty lines need an explicit `<br>` so the cursor has somewhere
      // to land.
      const inner = inlineMdToHtml(line);
      out.push(`<div>${inner === '' ? '<br>' : inner}</div>`);
    }
  }
  closeList();
  return out.join('');
}

function inlineMdToHtml(line: string): string {
  const escaped = escapeHtml(line);
  // Bold first (longer marker), then italic, so `**a**` doesn't get
  // chewed by the italic pass.
  return escaped
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * Walk a `contentEditable`-flavoured DOM tree and serialise it back
 * to the Markdown subset that storage expects. Anything outside the
 * supported tags (bold/italic/list/block wrappers) collapses to its
 * text content — e.g. pasted images, links, headings drop their
 * formatting but keep their words.
 *
 * The walker tolerates both Chrome's `<div>`-per-line layout and
 * Firefox's `<br>`-separator layout. Multiple blank-line runs are
 * collapsed to at most one (typical contentEditable artefact).
 */
export function htmlToMarkdown(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const raw = walkNode(tmp);
  // Trim trailing newlines (block wrappers always emit one) and
  // collapse runs of 3+ newlines into 2 — matches what users mean.
  return raw.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '');
}

function walkNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') return '\n';

  const inner = Array.from(el.childNodes).map(walkNode).join('');

  switch (tag) {
    case 'strong':
    case 'b':
      return inner.length === 0 ? '' : `**${inner}**`;
    case 'em':
    case 'i':
      return inner.length === 0 ? '' : `*${inner}*`;
    case 'ul':
    case 'ol':
      return inner;
    case 'li':
      return `- ${inner.replace(/\n+$/, '')}\n`;
    case 'div':
    case 'p': {
      // A `<div>` whose only child is `<br>` is a literal blank
      // line — emit one newline, not two.
      const onlyChild = el.childNodes.length === 1 ? el.firstChild : null;
      if (
        onlyChild &&
        onlyChild.nodeType === Node.ELEMENT_NODE &&
        (onlyChild as Element).tagName.toLowerCase() === 'br'
      ) {
        return '\n';
      }
      return `${inner}\n`;
    }
    default:
      return inner;
  }
}
