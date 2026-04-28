import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import GithubSlugger from 'github-slugger';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

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

interface TocItem {
  id: string;
  label: string;
}

/** Parse `## Heading` lines from a markdown source and slug them
 *  the same way `rehype-slug` does at render time. Returns the
 *  ordered list ready for the TOC rail. */
export function parseToc(source: string): ReadonlyArray<TocItem> {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
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
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      const label = match[1]!;
      items.push({ id: slugger.slug(label), label });
    }
  }
  return items;
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
      className="mb-3 mt-10 scroll-mt-24 text-[22px] font-semibold tracking-[-0.01em] text-ink first:mt-0"
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      {...props}
      className="mb-2 mt-6 scroll-mt-24 text-[16px] font-semibold text-ink"
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-[14.5px] leading-[1.65] text-ink-soft last:mb-0">
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
  code: ({ children, className }) => (
    <code
      className={
        className ??
        'rounded bg-bg-2 px-1.5 py-0.5 font-mono text-[13px] text-ink'
      }
    >
      {children}
    </code>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  // Custom block: raw `<aside class="docs-hint">…</aside>` in the
  // markdown source becomes a styled hint card pointing at the next
  // tab. `rehype-raw` is what makes this `aside` reach us as an
  // actual element rather than escaped text.
  aside: ({ children, className }) => {
    if (className === 'docs-hint') {
      return (
        <aside className="mt-10 rounded-lg border border-hair bg-bg-2 px-5 py-4 text-[14px] leading-[1.6] text-ink-soft">
          {children}
        </aside>
      );
    }
    return <aside className={className}>{children}</aside>;
  },
};

const markdownPlugins = [rehypeRaw, rehypeSlug];

/** Render a docs tier from its markdown source. */
export function MarkdownTier({ source }: { source: string }) {
  return (
    <ReactMarkdown
      rehypePlugins={markdownPlugins}
      components={markdownComponents}
    >
      {source}
    </ReactMarkdown>
  );
}
