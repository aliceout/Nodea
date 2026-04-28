import { useEffect, useState } from 'react';

interface TocChild {
  id: string;
  label: string;
}

interface TocSection {
  id: string;
  label: string;
  children: ReadonlyArray<TocChild>;
}

interface DocsTocProps {
  /** Section tree for the active tier. The order drives the rail
   *  rendering; ids must match the `<h2 id>` / `<h3 id>` anchors
   *  emitted by the markdown render (`rehype-slug`). */
  sections: ReadonlyArray<TocSection>;
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
 * Scroll-spy via `IntersectionObserver` highlights the heading
 * currently in view. Both `<h2>` and `<h3>` anchors are observed,
 * so the active id can land on a sub-section. The active section's
 * children are revealed; siblings stay collapsed to keep the rail
 * tight. The observer's `rootMargin` biases the "active band"
 * toward the top third of the viewport so the highlight tracks
 * the heading the reader is *currently reading*, not the next one
 * about to scroll into view.
 */
export default function DocsToc({ sections, title }: DocsTocProps) {
  const firstId = sections[0]?.id ?? null;
  const [activeId, setActiveId] = useState<string | null>(firstId);

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
      for (const c of s.children) {
        const childEl = document.getElementById(c.id);
        if (childEl) observer.observe(childEl);
      }
    }

    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  // The "active section" is the `<h2>` whose own anchor is active,
  // OR the parent of the active `<h3>`. Only this section's
  // children are shown — others stay collapsed.
  const activeSection =
    sections.find(
      (s) => s.id === activeId || s.children.some((c) => c.id === activeId),
    ) ?? null;

  return (
    <nav aria-label="Sur cette page">
      <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-muted">
        {title ?? 'Sur cette page'}
      </p>
      <ul className="space-y-1.5 border-l border-hair">
        {sections.map((s) => {
          const isActiveSection = s === activeSection;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                data-active={isActiveSection}
                className={
                  isActiveSection
                    ? '-ml-px block border-l-2 border-accent pl-3 text-[13.5px] leading-[1.45] text-accent'
                    : '-ml-px block border-l-2 border-transparent pl-3 text-[13.5px] leading-[1.45] text-muted transition-colors hover:text-ink'
                }
              >
                {s.label}
              </a>
              {isActiveSection && s.children.length > 0 ? (
                <ul className="mt-1.5 space-y-1.5">
                  {s.children.map((c) => {
                    const active = c.id === activeId;
                    return (
                      <li key={c.id}>
                        <a
                          href={`#${c.id}`}
                          data-active={active}
                          className={
                            active
                              ? 'block pl-7 text-[12.5px] leading-[1.45] text-accent'
                              : 'block pl-7 text-[12.5px] leading-[1.45] text-muted transition-colors hover:text-ink'
                          }
                        >
                          {c.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
