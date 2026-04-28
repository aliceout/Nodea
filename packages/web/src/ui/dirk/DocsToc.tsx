import { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  label: string;
}

interface DocsTocProps {
  /** Section list for the active tier. The order drives the rail
   *  rendering; ids must match the `<h2 id>` anchors emitted by
   *  the markdown render (`rehype-slug`). */
  sections: ReadonlyArray<TocItem>;
  /** Optional rail header — defaults to "Sur cette page". */
  title?: string;
}

/**
 * Docs left-rail TOC — Direction K · Sauge.
 *
 * The TOC component is rendering-only — sticky positioning and
 * visibility breakpoints are owned by the parent (`DocsLayout`)
 * so the rail's natural top can align with the topbar exactly,
 * eliminating the "catches a few px after scrolling" effect.
 *
 * Scroll-spy via `IntersectionObserver` highlights the section
 * currently in view. The observer's `rootMargin` biases the
 * "active band" toward the top third of the viewport so the
 * highlight tracks the section the reader is *currently
 * reading*, not the next one about to scroll into view.
 */
export default function DocsToc({ sections, title }: DocsTocProps) {
  const [activeId, setActiveId] = useState<string | null>(
    sections[0]?.id ?? null,
  );

  useEffect(() => {
    if (sections.length === 0) return undefined;
    setActiveId(sections[0]!.id);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: '-10% 0px -70% 0px',
        threshold: 0,
      },
    );

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav aria-label="Sur cette page">
      <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-muted">
        {title ?? 'Sur cette page'}
      </p>
      <ul className="space-y-1.5 border-l border-hair">
        {sections.map((s) => {
          const active = s.id === activeId;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                data-active={active}
                className={
                  active
                    ? '-ml-px block border-l-2 border-accent pl-3 text-[13.5px] leading-[1.45] text-ink'
                    : '-ml-px block border-l-2 border-transparent pl-3 text-[13.5px] leading-[1.45] text-muted transition-colors hover:text-ink'
                }
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
