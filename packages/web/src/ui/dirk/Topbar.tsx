import type { ReactNode } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import NodeaSymbol from '@/ui/branding/NodeaSymbol';

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
  /** Muted breadcrumb-style label on the left, visible at every
   *  breakpoint (it carries the module name on mobile, where the big
   *  in-content heading is the only other cue). Truncates rather than
   *  wraps. Strings work; ReactNode is allowed for the rare case where
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
  const { t } = useI18n();
  return (
    <div className="sticky top-0 z-20 flex h-[52px] items-center gap-2 border-b border-hair bg-bg px-6 sm:px-9">
      {/* Brand mark on the left, mobile-only — desktop carries the
          logo in the persistent sidebar. Decorative (the label is the
          accessible name). */}
      <NodeaSymbol className="h-5 w-5 shrink-0 text-accent lg:hidden" />
      <span className="block min-w-0 truncate text-[13px] font-semibold tracking-[0.02em] text-ink">
        {label}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {children}
        <Button
          variant="neutral"
          size="md"
          iconOnly
          onClick={onOpenMenu}
          aria-label={t('layout.header.openMenu')}
          className="text-ink-soft lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
