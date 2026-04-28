import type { ReactNode } from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

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
          <div className="mx-auto flex max-w-[1180px] justify-center px-6 py-2">
            {tabs}
          </div>
        </div>
      ) : null}

      <main className="flex-1">
        <div className="mx-auto max-w-[1180px] px-6 sm:px-9">
          <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-12">
            {/* Aside : sticky right under the topbar from scroll=0.
                No top padding on its column so the natural position
                matches `top-[52px]` and the rail doesn't drift before
                "catching". */}
            {aside ? (
              <div className="hidden lg:block lg:sticky lg:top-[52px] lg:max-h-[calc(100vh-52px)] lg:overflow-y-auto lg:py-12">
                {aside}
              </div>
            ) : null}
            <div className="max-w-[760px] py-12 sm:py-16">{children}</div>
          </div>
        </div>
      </main>

      <footer className="border-t border-hair">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-6 py-5 text-[12px] text-muted sm:px-9">
          <span>Nodea — chiffré côté client · auto-hébergeable</span>
          <a
            href="https://github.com/aliceout/Nodea"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex cursor-pointer items-center gap-1 text-accent underline-offset-2 transition-colors hover:text-accent-deep hover:underline"
          >
            Code source
            <ArrowTopRightOnSquareIcon className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </footer>
    </div>
  );
}
