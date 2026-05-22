import type { ReactNode } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';

import Button from '@/ui/atoms/dirk/Button';

/**
 * Per-page topbar — shared chassis for every module / settings
 * surface. 52 px tall, hairline border, sticky to the top of the
 * scroll container so the page header stays pinned while the
 * content scrolls.
 *
 * The hamburger sits at the far-right end of the row (after the
 * per-page actions) and is `lg:hidden` because the persistent
 * sidebar takes over above `lg` — pages don't have to gate that
 * themselves. Right-anchored on purpose : matches the dominant
 * mobile pattern of every recent personal-app design we've
 * cross-checked, and keeps the thumb-reachable corner consistent
 * across modules.
 *
 * `children` renders on the right side and is the open slot for
 * per-page actions (CTA buttons, search triggers, etc.). Pages
 * that only need a breadcrumb (Account, Admin) leave it empty
 * and the row collapses to label-only.
 */
interface TopbarProps {
  /** Muted breadcrumb-style label on the left, after the hamburger.
   *  Strings work; ReactNode is allowed for the rare case where
   *  the label needs inline emphasis. */
  label: ReactNode;
  /** Opens the mobile sidebar drawer. Wired through to the page
   *  parent because the drawer state lives on the global Zustand
   *  store. */
  onOpenMenu: () => void;
  /** Right-hand content. Typically `<Button variant="primary"
   *  size="sm">+ Nouvelle entrée</Button>` for module pages; can
   *  also pack a search trigger or several siblings. */
  children?: ReactNode;
}

export default function Topbar({ label, onOpenMenu, children }: TopbarProps) {
  return (
    <div className="sticky top-0 z-20 flex h-[52px] items-center gap-3 border-b border-hair bg-bg px-6 sm:px-9">
      <span className="hidden min-w-0 truncate text-[12px] tracking-[0.02em] text-muted md:inline">
        {label}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {children}
        <Button
          variant="neutral"
          size="md"
          iconOnly
          onClick={onOpenMenu}
          aria-label="Ouvrir le menu"
          className="text-ink-soft lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
