import { Link, useNavigate } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

import Button from '@/ui/atoms/dirk/Button';
import {
  useNodeaStore,
  selectIsAuthenticated,
} from '@/core/store/nodea-store';

interface DocsTopbarProps {
  /** Optional content rendered between the logo and the right-hand
   *  cluster — used by `DocsLayout` to slot the tier `<Tabs>` in.
   *  Hidden on small viewports (`< sm`) to keep the row from
   *  wrapping; the layout exposes a fallback band below the
   *  topbar in that case. */
  children?: ReactNode;
}

/**
 * Topbar — Direction K · Sauge, public-facing variant.
 *
 * Three columns at all sizes:
 *   - logo (link back to /login or /flow/home)
 *   - middle slot (typically the page tabs; visible on sm+)
 *   - right cluster: external "Code source" link (sm+) + the
 *     primary CTA ("Se connecter" or "Retour à Nodea")
 *
 * The middle column always reserves `flex-1` space, even when the
 * tabs are hidden below `sm` — without it the right cluster
 * would collapse against the logo.
 */
export default function DocsTopbar({ children }: DocsTopbarProps) {
  const navigate = useNavigate();
  const isAuthenticated = useNodeaStore(selectIsAuthenticated);
  const target = isAuthenticated ? '/flow/home' : '/login';
  const ctaLabel = isAuthenticated ? 'Retour à Nodea' : 'Accéder à Nodea';

  function handleCtaClick(e: MouseEvent<HTMLButtonElement>): void {
    e.preventDefault();
    navigate(target);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hair bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-[52px] max-w-[1180px] items-center gap-6 px-6 sm:px-9">
        <Link
          to={target}
          className="flex shrink-0 cursor-pointer items-center gap-2.5 transition-opacity hover:opacity-80"
          aria-label="Retour à Nodea"
        >
          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-accent" />
          <span className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
            Nodea
          </span>
        </Link>

        <div className="flex flex-1 self-stretch justify-center">
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
    </header>
  );
}
