import { useState, type ReactNode } from 'react';

/**
 * Mobile-only « + Filtres » disclosure — folds a module's filter
 * sections so they don't squat at the bottom of the page when the
 * right-column `SideColumn` collapses below `lg`. Folded by default; a
 * leading `+` / `−` carries the affordance (no chevron icon). Renders
 * nothing at `lg+` via the wrapper's `lg:hidden`.
 *
 * Factored from three byte-identical `MobileFilters` (Goals / Journal /
 * Library, REFACTO-08). Each module keeps a thin wrapper that binds its
 * own toggle label + `FiltersContent`; the open/close mechanics live
 * here.
 *
 * `trailing` renders on the right of the toggle row (Journal shares that
 * line with its « carte d'écriture » toggle); when present the row
 * spreads (`justify-between`), otherwise the toggle aligns right.
 */
interface CollapsibleFiltersToggleProps {
  /** Already-resolved toggle label (e.g. `t('goals.side.filtersToggle')`). */
  label: string;
  /** The filter sections to reveal when open. */
  children: ReactNode;
  /** Optional right-of-toggle slot (Journal's chart toggle). */
  trailing?: ReactNode;
  /** Wrapper classes — defaults to `lg:hidden`. Goals/Library pass the
   *  spacing variant (`-mt-3.5 mb-[18px] lg:hidden`). */
  className?: string;
}

export default function CollapsibleFiltersToggle({
  label,
  children,
  trailing,
  className,
}: CollapsibleFiltersToggleProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className ?? 'lg:hidden'}>
      <div className={trailing ? 'flex items-center justify-between gap-3' : 'flex justify-end'}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-[12px] text-muted transition-colors hover:text-ink"
        >
          {open ? '− ' : '+ '}
          {label}
        </button>
        {trailing}
      </div>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
