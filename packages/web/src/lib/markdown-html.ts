/**
 * Markdown ⇆ HTML conversion for the lightweight subset the
 * Composer's visual `MarkdownEditor` round-trips : `**bold**`,
 * `*italic*`, `- bullet` lines.
 *
 * Split out of `lite-markdown.tsx` (audit 2026-06 passe 2) : that
 * file now exports the `memo`'d `LiteMarkdown` *component*, and the
 * `react-refresh/only-export-components` rule wants a component file
 * to export only components. These are pure string functions with no
 * JSX, so they live in their own `.ts` — the renderer and the editor
 * import what each needs.
 */

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
  let inQuote = false;

  function closeList() {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  }
  function closeQuote() {
    if (inQuote) {
      out.push('</blockquote>');
      inQuote = false;
    }
  }

  for (const line of lines) {
    if (line.startsWith('- ')) {
      closeQuote();
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineMdToHtml(line.slice(2))}</li>`);
    } else if (line.startsWith('>')) {
      closeList();
      if (!inQuote) {
        out.push('<blockquote>');
        inQuote = true;
      }
      // Strip the marker + one optional space ; each quoted line is a
      // `<div>` so the contentEditable edits it like any other line.
      const inner = inlineMdToHtml(line.replace(/^>\s?/, ''));
      out.push(`<div>${inner === '' ? '<br>' : inner}</div>`);
    } else {
      closeList();
      closeQuote();
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
  closeQuote();
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
    case 'blockquote': {
      // Each inner line (the child `<div>`s emit one `\n` apiece)
      // gets the `> ` marker back ; blank lines stay a bare `>`.
      const body = inner.replace(/\n+$/, '');
      return (
        body
          .split('\n')
          .map((l) => (l.length > 0 ? `> ${l}` : '>'))
          .join('\n') + '\n'
      );
    }
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
