import { Link, useNavigate } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';

import Button from '@/ui/atoms/dirk/Button';
import {
  useNodeaStore,
  selectIsAuthenticated,
} from '@/core/store/nodea-store';

interface DocsTopbarProps {
  /** Optional content rendered between the logo and the CTA — used
   *  by `DocsLayout` to slot the tier `<Tabs>` in. Hidden on
   *  small viewports (`< sm`) to keep the row from wrapping; the
   *  layout exposes a fallback band below the topbar in that
   *  case. */
  children?: ReactNode;
}

/**
 * Topbar — Direction K · Sauge, public-facing variant.
 *
 * Different from `dirk/Topbar.tsx` (in-app, breadcrumb +
 * hamburger): the public surface has no sidebar, and the
 * right-hand affordance is the entry point back into the auth
 * flow. The optional `children` slot in the middle hosts page-
 * level navigation (e.g. the Docs tabs).
 *
 * Logo on the left clicks back to `/login` (or `/flow/home` if a
 * session is already live). The right-hand button label flips
 * accordingly.
 */
export default function DocsTopbar({ children }: DocsTopbarProps) {
  const navigate = useNavigate();
  const isAuthenticated = useNodeaStore(selectIsAuthenticated);
  const target = isAuthenticated ? '/flow/home' : '/login';
  const ctaLabel = isAuthenticated ? 'Retour à Nodea' : 'Se connecter';

  function handleCtaClick(e: MouseEvent<HTMLButtonElement>): void {
    e.preventDefault();
    navigate(target);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hair bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-[52px] max-w-[1180px] items-center gap-6 px-6 sm:px-9">
        <Link
          to={target}
          className="flex shrink-0 items-center gap-2.5 cursor-pointer transition-opacity hover:opacity-80"
          aria-label="Retour à Nodea"
        >
          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-accent" />
          <span className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
            Nodea
          </span>
        </Link>

        {/* Middle slot — typically the page tabs. Hidden below sm
            so the topbar stays single-line; below-topbar fallback
            row in the layout picks up the slack. */}
        {children ? (
          <div className="hidden flex-1 sm:flex sm:justify-center">
            {children}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={handleCtaClick}
          className="shrink-0"
        >
          {ctaLabel}
        </Button>
      </div>
    </header>
  );
}
