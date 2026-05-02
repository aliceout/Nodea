import type { ReactNode } from 'react';

interface ModuleShellProps {
  /** Per-page topbar (`<Topbar label=... onOpenMenu=...>`). Always
   *  renders first, sticky to the top of the scroll container. */
  topbar: ReactNode;
  /** Right column at `lg+` (280 px). Typically a SideColumn with
   *  filters / stats. Below `lg` it stacks under the primary
   *  column. When omitted, the body collapses to a single
   *  full-width column. */
  side?: ReactNode;
  /** Primary content (left column when `side` is provided, full
   *  width otherwise). */
  children: ReactNode;
}

/**
 * Module page chassis — Direction K · Sauge.
 *
 * Wraps the topbar + the canonical 2-column grid (1fr / 280 px on
 * `lg+`, single column below) shared by every module page (Mood,
 * Journal, Goals, Library, Homepage). The wrapper itself is
 * `flex flex-col flex-1 min-w-0` so the page fills the main
 * column of the layout shell while the sticky topbar tracks the
 * window scroll, not a nested overflow.
 *
 * `side` is optional — pages without a SideColumn (rare) collapse
 * to a single column.
 */
export default function ModuleShell({ topbar, side, children }: ModuleShellProps) {
  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      {topbar}
      {side ? (
        <div className="grid grid-cols-1 gap-9 px-6 py-7 sm:px-9 lg:grid-cols-[1fr_280px]">
          {children}
          {side}
        </div>
      ) : (
        <div className="px-6 py-7 sm:px-9">{children}</div>
      )}
    </div>
  );
}
