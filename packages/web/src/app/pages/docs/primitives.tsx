import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import GithubSlugger from 'github-slugger';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

import KeyHierarchyDiagram from './diagrams/KeyHierarchyDiagram';
import OpaqueFlowDiagram from './diagrams/OpaqueFlowDiagram';
import SteppedMfaDiagram from './diagrams/SteppedMfaDiagram';
import MfaBypassDiagram from './diagrams/MfaBypassDiagram';

/**
 * Markdown rendering primitives for the docs tiers.
 *
 * Each tier ships its content as a `.md` file under `./content/`,
 * imported as a raw string (`?raw`) and passed to `MarkdownTier`
 * which renders it via `react-markdown`.
 *
 * Why markdown : easier to edit copy without JSX boilerplate, the
 * heading hierarchy auto-derives the left-rail TOC, and the
 * tier files become tiny re-export shells. Custom blocks (the
 * "Next tab" hint card) use raw HTML in the markdown source —
 * `rehype-raw` lets that pass through, and the `aside` element
 * override below restyles it consistently.
 *
 * The TOC is parsed from the markdown source (not the rendered
 * DOM) so it's available immediately at render time; ids are
 * generated using `github-slugger`, which is what `rehype-slug`
 * uses internally — they always agree.
 */

interface TocChild {
  id: string;
  label: string;
}

interface TocSection {
  id: string;
  label: string;
  children: ReadonlyArray<TocChild>;
}

/** Parse `## Heading` and `### Heading` lines from a markdown source
 *  and slug them the same way `rehype-slug` does at render time.
 *  Returns a tree of sections: each `##` becomes a section, each
 *  `###` is attached as a child of the most recent `##` above it.
 *  `###` headings before any `##` are dropped (no parent to attach
 *  to). */
export function parseToc(source: string): ReadonlyArray<TocSection> {
  const slugger = new GithubSlugger();
  const sections: Array<{
    id: string;
    label: string;
    children: TocChild[];
  }> = [];
  const lines = source.split('\n');
  let inFence = false;
  for (const line of lines) {
    // Skip fenced code blocks — `## Foo` inside ``` ``` is not a
    // real heading.
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(##|###)\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const level = match[1]!.length === 2 ? 2 : 3;
    const label = match[2]!;
    const id = slugger.slug(label);
    if (level === 2) {
      sections.push({ id, label, children: [] });
    } else {
      const last = sections[sections.length - 1];
      if (last) last.children.push({ id, label });
    }
  }
  return sections;
}

/**
 * Component overrides applied to react-markdown's default render.
 * We deliberately do NOT use `@tailwindcss/typography` — the visual
 * design has its own rhythm and we want to match it exactly rather
 * than fight `prose` defaults. Each rule below mirrors the styling
 * the previous JSX `<Section>` / `<Bullet>` carried.
 */
const markdownComponents: Components = {
  h2: ({ children, ...props }) => (
    <h2
      {...props}
      className="mb-3 mt-10 scroll-mt-24 text-[22px] font-semibold tracking-[-0.01em] text-accent first:mt-0"
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      {...props}
      className="relative mb-3 mt-8 scroll-mt-24 pl-5 text-[18px] font-semibold tracking-[-0.005em] text-ink before:absolute before:left-0 before:top-1/2 before:h-2 before:w-2 before:-translate-y-1/2 before:rounded-full before:bg-accent before:content-['']"
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-justify text-[14.5px] leading-[1.65] text-ink-soft last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => <ul className="my-4 space-y-2">{children}</ul>,
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-2 pl-6 text-[14.5px] leading-[1.65] text-ink-soft">
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => {
    // `react-markdown` calls `li` for both `ul` and `ol` items. We
    // use the inferred type (the parent passed via `node.parent` in
    // older versions, but here we just style for both): a flex row
    // with a tiny accent disc for the bulleted variant. Ordered
    // lists fall back to native numbering via the `<ol>` override
    // above (the `<li>` here would over-indent if we always used the
    // flex variant; we accept the styling drift on `<ol>` since it's
    // rare in this content).
    return (
      <li
        {...props}
        className="flex gap-2.5 text-[14.5px] leading-[1.65] text-ink-soft"
      >
        <span
          aria-hidden="true"
          className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-accent"
        />
        <span className="min-w-0 flex-1">{children}</span>
      </li>
    );
  },
  a: ({ children, href, ...props }) => {
    const isExternal =
      typeof href === 'string' && /^https?:\/\//i.test(href);
    if (isExternal) {
      return (
        <a
          {...props}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:text-accent-deep hover:underline"
        >
          {children}
          <ArrowTopRightOnSquareIcon
            className="h-3 w-3"
            aria-hidden="true"
          />
        </a>
      );
    }
    return (
      <a
        {...props}
        href={href}
        className="text-accent underline-offset-2 hover:text-accent-deep hover:underline"
      >
        {children}
      </a>
    );
  },
  code: ({ children, className }) => {
    // react-markdown calls this for both inline code and the
    // <code> child inside fenced blocks. The fenced-block path
    // emits a `language-xxx` className (or sometimes none, when
    // no language is specified). The `pre` override below wraps
    // those in a styled block; here we just need to NOT apply
    // the inline pill styling in that case.
    const isBlock = typeof className === 'string';
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="rounded bg-bg-2 px-1.5 py-0.5 font-mono text-[13px] text-ink">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg bg-bg-2 p-4 font-mono text-[12px] leading-[1.55] text-ink-soft">
      {children}
    </pre>
  ),
  // GFM tables — react-markdown needs these explicit overrides
  // because the default `<table>` rendering inherits the
  // `text-justify` from `<p>` siblings and produces unreadable
  // cells. The wrapper allows horizontal scroll on narrow
  // viewports rather than overflowing the article column.
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13.5px] leading-[1.55]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-hair text-ink">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-hair last:border-b-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 align-top font-semibold first:pl-0 last:pr-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 align-top text-ink-soft first:pl-0 last:pr-0">
      {children}
    </td>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  // Custom blocks. `rehype-raw` lets a `<aside class="X">` slip
  // through the markdown source untouched ; we switch on the
  // class here to render either a styled hint card or an inline
  // SVG diagram. Unknown classes fall back to a vanilla `aside`
  // so future custom blocks aren't silently dropped.
  aside: ({ children, className }) => {
    if (className === 'docs-hint') {
      return (
        <aside className="mt-10 rounded-lg border border-hair bg-bg-2 px-5 py-4 text-[14px] leading-[1.6] text-ink-soft">
          {children}
        </aside>
      );
    }
    if (className === 'docs-diagram-key-hierarchy') {
      return <KeyHierarchyDiagram />;
    }
    if (className === 'docs-diagram-opaque-flow') {
      return <OpaqueFlowDiagram />;
    }
    if (className === 'docs-diagram-stepped-mfa') {
      return <SteppedMfaDiagram />;
    }
    if (className === 'docs-diagram-mfa-bypass') {
      return <MfaBypassDiagram />;
    }
    return <aside className={className}>{children}</aside>;
  },
};

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeRaw, rehypeSlug];

/**
 * Render a docs tier from its markdown source.
 *
 * `remark-gfm` is what unlocks GitHub-flavoured tables, strike-
 * through, and task lists in the markdown source — without it,
 * `| col | col |` lines render as literal text rather than
 * tables. `rehype-raw` lets us keep raw `<aside>` blocks in the
 * markdown for the docs-hint callouts; `rehype-slug` adds `id`
 * attrs to headings so the TOC anchor links work.
 *
 * The `lang="fr"` + `hyphens-auto` wrapper enables proper French
 * hyphenation in justified paragraphs.
 */
export function MarkdownTier({ source }: { source: string }) {
  return (
    <div lang="fr" className="hyphens-auto">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
