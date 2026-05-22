import { useState } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';

import { FiltersContent } from './SideColumn';

/**
 * Mobile-only Filters toggle for Goals — folds the filter
 * sections (recherche, statut, groupement, tri, affichage,
 * actions / report d'année) so they don't sit at the bottom of
 * the page when the right-column sidebar (`SideColumn`)
 * collapses below `lg`. Folded by default ; the user opens it on
 * demand.
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
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-[12px] text-muted transition-colors hover:text-ink"
      >
        {open ? '− ' : '+ '}
        {t('goals.side.filtersToggle')}
      </button>
      {open ? (
        <div className="mt-3">
          <FiltersContent />
        </div>
      ) : null}
    </div>
  );
}
