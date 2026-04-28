import { Link, useNavigate } from 'react-router-dom';
import type { MouseEvent } from 'react';

import Button from '@/ui/atoms/dirk/Button';
import {
  useNodeaStore,
  selectIsAuthenticated,
} from '@/core/store/nodea-store';

/**
 * Topbar — Direction K · Sauge, public-facing variant.
 *
 * Shared chassis for `/docs` (and future public pages). Different
 * from `dirk/Topbar.tsx` (in-app, breadcrumb + hamburger) because
 * the public surface has no sidebar to toggle, and the right-hand
 * affordance is the entry point back into the auth flow.
 *
 * Logo on the left clicks back to `/login` (or `/flow/home` if a
 * session is already live). The right-hand button label flips
 * accordingly: "Se connecter" for guests, "Retour à Nodea" for
 * authenticated users — same target as the logo, the redundancy
 * is intentional (logo as wordmark, button as explicit CTA).
 */
export default function DocsTopbar() {
  const navigate = useNavigate();
  const isAuthenticated = useNodeaStore(selectIsAuthenticated);
  const target = isAuthenticated ? '/flow/home' : '/login';
  const ctaLabel = isAuthenticated ? 'Retour à Nodea' : 'Se connecter';

  function handleCtaClick(e: MouseEvent<HTMLButtonElement>): void {
    e.preventDefault();
    navigate(target);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-hair bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-[52px] max-w-[1200px] items-center justify-between px-6 sm:px-9">
        <Link
          to={target}
          className="flex items-center gap-2.5 cursor-pointer transition-opacity hover:opacity-80"
          aria-label="Retour à Nodea"
        >
          <span aria-hidden="true" className="h-3 w-3 rounded-full bg-accent" />
          <span className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
            Nodea
          </span>
        </Link>

        <Button variant="primary" size="sm" onClick={handleCtaClick}>
          {ctaLabel}
        </Button>
      </div>
    </header>
  );
}
