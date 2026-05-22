import { useState } from 'react';

import { FiltersContent } from './SideColumn';

/**
 * Mobile-only Filters toggle for Library — folds the filter
 * sections (Grouper par, Statut chips, Tags) so they don't sit
 * at the bottom of the page when the right-column sidebar
 * (`SideColumn`) collapses below `lg`. Folded by default ; the
 * user opens it on demand.
 *
 * Renders nothing at `lg+` — the regular sticky sidebar takes
 * over via `<SideColumn>` in the ModuleShell `side` slot.
 *
 * Toggle string mirrors the existing « + Filtres » pattern from
 * Journal's MobileFilters : a leading `+` / `−` carries the
 * affordance, no chevron icon. Hardcoded label (not i18n) because
 * Library's UI strings are still hardcoded across the board —
 * cf. « Grouper par », « Statut » in `SideColumn`.
 */
export default function MobileFilters() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-[12px] text-muted transition-colors hover:text-ink"
      >
        {open ? '− ' : '+ '}Filtres
      </button>
      {open ? (
        <div className="mt-3">
          <FiltersContent />
        </div>
      ) : null}
    </div>
  );
}
