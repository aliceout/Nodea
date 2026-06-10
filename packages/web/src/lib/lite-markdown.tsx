import { memo, type ReactNode } from 'react';

/**
 * Render plain-text content with the lightweight Markdown subset
 * the Composer's `MarkdownEditor` produces : `**bold**`, `*italic*`,
 * `- bullet` lines. Newlines that aren't part of a list keep their
 * breaks via `whitespace-pre-wrap`.
 *
 * Type sized to match Mood's entry rows (`text-[13px] leading-[1.5]`,
 * sans-serif) so the modules feel like one app rather than two.
 *
 * Kept tiny on purpose — no headings, no links, no nesting beyond
 * inline-on-line. A real Markdown renderer would pull in `react-
 * markdown` + `remark-gfm` for ~30 KB ; the app only needs three
 * shapes, so a 40-line walker stays in source. Shared across
 * Journal (saved entries + reader), Library (reviews), and the
 * `MarkdownEditor` preview pane (so what you see while writing is
 * exactly what gets rendered after save).
 *
 * Issue #5 — used to live in `lib/journal-markdown.tsx` named
 * `JournalContent`. Renamed once it became clear it serves more
 * than Journal ; the old name was a documentation bug.
 */
/**
 * `memo`-wrapped (audit 2026-06 passe 2) — the prop is a single
 * primitive `string`, so the shallow compare is exact and free.
 * Without it, every render of a row that embeds LiteMarkdown
 * (EntryRow's clamped content, every ReviewsList row) re-tokenised
 * the full text ; combined with the grouped-list re-render
 * cascades, a Journal/Library list re-parsed hundreds of bodies per
 * context churn.
 */
export const LiteMarkdown = memo(function LiteMarkdown({
  text,
}: {
  text: string;
}) {
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
});

/**
 * Tokenise a single line into bold / italic / plain runs. Greedy
 * matches `**…**` first, then `*…*`. Doesn't try to handle nesting
 * (intentional — see `LiteMarkdown`).
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

