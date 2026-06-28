import type { ReactNode } from 'react';

import { ModuleSettingsProvider } from './module-settings-context';

interface ModuleShellProps {
  /** Per-page topbar (`<Topbar label=... onOpenMenu=...>`). Always
   *  renders first, sticky to the top of the scroll container. */
  topbar: ReactNode;
  /** Right column at `lg+`. Typically a SideColumn with filters /
   *  stats. Below `lg` it stacks under the primary column. When
   *  omitted, the body collapses to a single full-width column. */
  side?: ReactNode;
  /** Primary content (left column when `side` is provided, full
   *  width otherwise). */
  children: ReactNode;
  /** Optional mobile floating action button (`<SpeedDial>`). Fixed-
   *  position (portalled to body), so it renders outside the grid flow;
   *  `lg:hidden` lives in the dial itself. Pass the module's create
   *  CTA(s) here for the mobile layout. */
  fab?: ReactNode;
  /** Two-column layout flavour at `lg+` :
   *   - `'aside'` (default) : `1fr / 280 px` — narrow sidebar for
   *     chip filters and stats. Used by Mood / Journal / Goals /
   *     Library where the primary content is the focus.
   *   - `'split'` : `1fr / 1fr` — equal halves. Used by the
   *     Homepage where both columns aggregate independent
   *     surfaces (à voir + journal récent on one side, Mood /
   *     Goals overviews on the other). */
  layout?: 'aside' | 'split';
}

/**
 * Module page chassis — Direction K · Sauge.
 *
 * Wraps the topbar + a 2-column grid shared by every module page
 * (Mood, Journal, Goals, Library, Homepage). The wrapper itself
 * is `flex flex-col flex-1 min-w-0` so the page fills the main
 * column of the layout shell while the sticky topbar tracks the
 * window scroll, not a nested overflow.
 *
 * Two grid ratios :
 *   - `aside` (default) : `1fr / 280 px` — narrow sidebar.
 *   - `split` : `1fr / 1fr` — equal halves (Homepage).
 *
 * `side` is optional — pages without a SideColumn (rare) collapse
 * to a single column.
 */
export default function ModuleShell({
  topbar,
  side,
  children,
  fab,
  layout = 'aside',
}: ModuleShellProps) {
  return (
    <ModuleSettingsProvider>
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      {topbar}
      {fab}
      {side ? (
        <div
          className={
            // Two columns only when there's real horizontal room : `lg`
            // AND landscape. Tablets in portrait (e.g. Galaxy Tab S8+)
            // report ≥ lg CSS width but can't fit nav + content + side,
            // so they collapse to one column and the module's
            // MobileFilters takes over (see SideColumn / MobileFilters,
            // both gated `lg:landscape:`).
            layout === 'split'
              ? 'grid grid-cols-1 gap-9 px-6 py-7 sm:px-9 lg:landscape:grid-cols-2'
              : 'grid grid-cols-1 gap-9 px-6 py-7 sm:px-9 lg:landscape:grid-cols-[1fr_280px]'
          }
        >
          {children}
          {side}
        </div>
      ) : (
        <div className="px-6 py-7 sm:px-9">{children}</div>
      )}
    </div>
    </ModuleSettingsProvider>
  );
}
