import type { ReactNode } from 'react';

/**
 * Shared right-column shell for module pages (Mood / Journal / Goals /
 * Library).
 *
 * Each module previously carried its own, byte-identical `<aside>`
 * wrapper — same sticky offset, same responsive gate — differing only
 * in the content (filters vs lifetime stats). Factored here so that
 * shell lives in ONE place ; the per-module sections stay in each
 * module's `SideColumn` and are passed as `children`.
 *
 * Visibility : shown only at `lg` AND landscape. A portrait tablet
 * (e.g. Galaxy Tab S8+) reports ≥ lg CSS width but has no room for
 * nav + content + side, so below that threshold the column is hidden
 * and the module's `MobileFilters` collapse takes over (also
 * `lg:landscape:`-gated). Keep this the single source of truth for the
 * breakpoint — changing it here updates every module at once.
 */
export default function ModuleSidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="sticky top-20 hidden min-w-0 flex-col gap-6 self-start lg:landscape:flex">
      {children}
    </aside>
  );
}
