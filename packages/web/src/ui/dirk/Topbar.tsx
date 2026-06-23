import type { ReactNode } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
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
 * per-page actions (CTA buttons, the mobile search toggle, etc.).
 * Pages that only need a breadcrumb (Account, Admin) leave it empty
 * and the row collapses to label-only.
 *
 * `search` is a desktop-only left slot (≥ lg) for the inline search
 * field. On mobile it stays empty and the module `label` shows there
 * instead; the mobile search magnifier lives in `children` on the
 * right. So desktop reads « [search …] … [actions] » while mobile
 * reads « [module name] … [🔍][burger] » (the sidebar already shows
 * the active module on desktop, so the name is redundant there).
 */
interface TopbarProps {
  /** Muted breadcrumb-style label carrying the module name. Always
   *  shown on mobile (the collapsed sidebar can't, and the big
   *  in-content heading is `lg`-only). On desktop it shows too —
   *  EXCEPT when a `search` slot is present, which takes this spot
   *  (the desktop sidebar already highlights the active module).
   *  Truncates rather than wraps. */
  label: ReactNode;
  /** Opens the mobile sidebar drawer. Wired through to the page
   *  parent because the drawer state lives on the global Zustand
   *  store. */
  onOpenMenu: () => void;
  /** Left search slot — a single `<TopbarSearch>`. On desktop it's the
   *  inline field (grows up to its own `max-w`, taking the label's
   *  spot); on mobile it collapses to a magnifier pinned right. Omit on
   *  pages without search. */
  search?: ReactNode;
  /** Right-hand content. Typically `<Button variant="primary"
   *  size="sm">+ Nouvelle entrée</Button>` plus the mobile search
   *  magnifier; can pack several siblings. */
  children?: ReactNode;
}

export default function Topbar({ label, onOpenMenu, search, children }: TopbarProps) {
  const { t } = useI18n();
  return (
    <div className="sticky top-0 z-20 flex h-[52px] items-center gap-2 border-b border-hair bg-bg px-6 sm:px-9">
      {/* Brand mark on the left, mobile-only — desktop carries the
          logo in the persistent sidebar. Decorative (the label is the
          accessible name). */}
      <NodeaSymbol className="h-5 w-5 shrink-0 text-accent lg:hidden" />
      {/* Module name. Hidden on desktop only when a search field takes
          this slot; otherwise it shows at every breakpoint. */}
      <span
        className={cn(
          'block min-w-0 truncate text-[13px] font-semibold tracking-[0.02em] text-ink',
          search ? 'lg:hidden' : '',
        )}
      >
        {label}
      </span>
      {/* Search slot — grows to fill the row. Holds the single
          <TopbarSearch> (desktop field / mobile magnifier-pinned-right). */}
      {search ? (
        <div className="flex min-w-0 flex-1 items-center">{search}</div>
      ) : null}
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
