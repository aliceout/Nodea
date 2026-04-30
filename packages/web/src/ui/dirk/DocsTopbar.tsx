import { Link, useNavigate } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

import Button from '@/ui/atoms/dirk/Button';
import NodeaSymbol from '@/ui/branding/NodeaSymbol';
import ThemeSwitch from '@/ui/dirk/ThemeSwitch';
import {
  useNodeaStore,
  selectIsAuthenticated,
} from '@/core/store/nodea-store';

interface DocsTopbarProps {
  /** Optional content rendered between the logo and the right-hand
   *  cluster — used by `DocsLayout` to slot the tier `<Tabs>` in.
   *  Hidden on small viewports (`< sm`); the layout exposes a
   *  fallback band below the topbar in that case. */
  children?: ReactNode;
}

/**
 * Topbar — Direction K · Sauge, public-facing variant.
 *
 * The inner row mirrors the body grid below on `lg+`:
 * `[220px aside col] [gap-12] [article col]` plus an `auto` right
 * cluster column. So the tabs in the middle slot start at exactly
 * the same vertical line as the article body — visual continuity
 * between the topbar and the page content.
 *
 * Below `lg`, the layout falls back to a 3-column flex with
 * `gap-6` and centered tabs (no aside is rendered there, so
 * grid alignment isn't useful).
 *
 * Right cluster (inside the centered max-w container):
 *   - "Accéder à Nodea" / "Retour à Nodea" — primary CTA
 *   - "Code source" — secondary external link styled as a
 *     neutral-ghost button (transparent bg + hairline border +
 *     muted text). Hidden below `sm` to keep the row tight.
 *
 * `<ThemeSwitch>` is positioned absolutely against the viewport's
 * right edge — outside the centered `max-w-[1180px]` container so
 * it stays flush regardless of where the inner content sits. On
 * narrow viewports the absolute element would crowd the right
 * cluster, so it's hidden below `sm`.
 */
export default function DocsTopbar({ children }: DocsTopbarProps) {
  const navigate = useNavigate();
  const isAuthenticated = useNodeaStore(selectIsAuthenticated);
  const target = isAuthenticated ? '/flow' : '/login';
  const ctaLabel = isAuthenticated ? 'Retour à Nodea' : 'Accéder à Nodea';

  function handleCtaClick(e: MouseEvent<HTMLButtonElement>): void {
    e.preventDefault();
    navigate(target);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hair bg-bg/95 backdrop-blur">
      <div className="mx-auto max-w-[1180px] px-6 sm:px-9">
        <div className="flex h-[52px] items-center gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-stretch lg:gap-12">
          <Link
            to={target}
            className="flex shrink-0 cursor-pointer items-center gap-2.5 self-center transition-opacity hover:opacity-80"
            aria-label="Retour à Nodea"
          >
            <NodeaSymbol className="h-5 w-5 text-accent" />
            <span className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
              Nodea{' '}
              <span className="font-normal text-muted">· Documentation</span>
            </span>
          </Link>

          <div className="flex flex-1 self-stretch justify-center lg:justify-start">
            {children ? (
              <div className="hidden h-full sm:flex">{children}</div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleCtaClick}>
              {ctaLabel}
            </Button>
            {/* Styled as an `<a>` (not the Button component) so right-
                click / middle-click / Cmd-click open in a new tab as
                expected. Visual matches `Button variant="neutral"
                size="sm"` but with the muted text of `ghost` —
                hairline border so it reads as a button without
                competing for attention with the primary CTA. */}
            <a
              href="https://github.com/aliceout/Nodea"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-hair bg-transparent px-3 text-[12px] font-semibold text-muted transition-[background-color,color] duration-150 hover:bg-bg-2 hover:text-ink sm:inline-flex"
            >
              Code source
              <ArrowTopRightOnSquareIcon
                className="h-3 w-3"
                aria-hidden="true"
              />
            </a>
          </div>
        </div>
      </div>
      <div className="absolute right-2 top-0 hidden h-13 items-center sm:flex">
        <ThemeSwitch />
      </div>
    </header>
  );
}
