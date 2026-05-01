import type { ReactNode } from 'react';

import DocsTopbar from '@/ui/dirk/DocsTopbar';

interface DocsLayoutProps {
  children: ReactNode;
  /** Left-rail TOC (rendered on `lg+`). Hidden below `lg` —
   *  the tabs and scrolling are sufficient on mobile. */
  aside?: ReactNode;
  /** Page-level tabs slotted into the topbar's middle column on
   *  `sm+`. On `< sm`, the tabs fall back to a band below the
   *  topbar so the row doesn't wrap. */
  tabs?: ReactNode;
}

/**
 * Public docs chassis — Direction K · Sauge.
 *
 * Layout on `lg+` is two-column: a sticky TOC rail on the left
 * (flush with the topbar — no initial scroll movement before it
 * "catches"), an article column on the right with comfortable
 * max-width.
 *
 * Topbar embeds the page tabs in its middle slot on `sm+`. Below
 * `sm` the tabs become a separate band right under the topbar.
 *
 * The aside's natural top position aligns with `top-[52px]` (the
 * topbar height), so sticky kicks in immediately at scroll=0
 * rather than after the user has scrolled past padding.
 *
 * No footer — the only useful link there ("Code source") moved
 * into the topbar; the rest was decoration.
 */
export default function DocsLayout({ children, aside, tabs }: DocsLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <DocsTopbar>{tabs}</DocsTopbar>

      {/* Mobile fallback band for tabs (below sm). Hidden above
          sm where the topbar slot owns them. Sticky too, so the
          tabs stay reachable while scrolling on mobile. */}
      {tabs ? (
        <div className="sticky top-[52px] z-20 border-b border-hair bg-bg/95 backdrop-blur sm:hidden">
          <div className="mx-auto flex h-12 max-w-[1180px] justify-center px-6">
            {tabs}
          </div>
        </div>
      ) : null}

      <main id="main" className="flex-1">
        <div className="mx-auto max-w-[1180px] px-6 sm:px-9">
          <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-12">
            {/* Aside : sticky right under the topbar from scroll=0.
                Vertical padding lives inside the sticky wrapper so
                the natural top position matches `top-[52px]` and the
                rail doesn't drift before "catching". */}
            {aside ? (
              <div className="hidden lg:sticky lg:top-[52px] lg:block lg:max-h-[calc(100vh-52px)] lg:overflow-y-auto lg:py-12">
                {aside}
              </div>
            ) : null}
            <div className="max-w-[760px] py-12 sm:py-16 lg:pt-12">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
