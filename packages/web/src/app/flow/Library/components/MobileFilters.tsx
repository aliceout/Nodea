import { useState } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';

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
 * affordance, no chevron icon.
 */
export default function MobileFilters() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    // `-mt-3.5` halves the grid's `py-7` (28px) above → 14px. The space
    // below is set here (`mb-[18px]`, half the old `gap-9`) because the
    // index wraps this + the content in one grid cell, so no grid gap
    // sits between them — a negative margin couldn't reduce that gap
    // reliably.
    <div className="-mt-3.5 mb-[18px] lg:hidden">
      {/* Toggle aligned right ; the expandable content stays
          full-width below. */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-[12px] text-muted transition-colors hover:text-ink"
        >
          {open ? '− ' : '+ '}
          {t('library.side.filtersToggle')}
        </button>
      </div>
      {open ? (
        <div className="mt-3">
          <FiltersContent />
        </div>
      ) : null}
    </div>
  );
}
