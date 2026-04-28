import type { ReactNode } from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

import DocsTopbar from '@/ui/dirk/DocsTopbar';

interface DocsLayoutProps {
  children: ReactNode;
}

/**
 * Public docs chassis — Direction K · Sauge.
 *
 * Single-column page wrapper used by `/docs` (and any future
 * public read-only surface). Topbar is sticky, footer is a
 * single hairline row with the GitHub link — kept deliberately
 * minimal so the content has the spotlight.
 *
 * Different from `AuthLayout` (two-column, marketing-heavy):
 * docs are read content, the entire viewport width up to a
 * max-width is needed for comfortable reading.
 */
export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <DocsTopbar />
      <main className="flex-1">
        <div className="mx-auto max-w-[860px] px-6 py-12 sm:px-9 sm:py-16">
          {children}
        </div>
      </main>
      <footer className="border-t border-hair">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-5 text-[12px] text-muted sm:px-9">
          <span>Nodea — chiffré côté client · auto-hébergeable</span>
          <a
            href="https://github.com/aliceout/Nodea"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex cursor-pointer items-center gap-1 text-accent underline-offset-2 transition-colors hover:text-accent-deep hover:underline"
          >
            Code source
            <ArrowTopRightOnSquareIcon
              className="h-3 w-3"
              aria-hidden="true"
            />
          </a>
        </div>
      </footer>
    </div>
  );
}
