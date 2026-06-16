import type { ReactNode } from 'react';
import { useState } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';

import { FiltersContent } from './SideColumn';

/**
 * Mobile-only Filters toggle — folds the Journal's filter chips
 * (vue par fil / par mois, thread filter, gérer les fils) so they
 * don't squat at the bottom of the page when the right-column
 * sidebar (`SideColumn`) collapses below `lg`. Folded by default ;
 * the user opens it on demand.
 *
 * Renders nothing at `lg+` — the regular sticky sidebar takes
 * over via `<SideColumn>` in the ModuleShell `side` slot.
 *
 * Toggle string mirrors the existing « + Question du jour &
 * commentaire » pattern from the Mood composer : a leading
 * `+` / `−` carries the affordance, no chevron icon.
 *
 * `trailing` renders on the right of the toggle row (the entries list
 * shares this line with the « carte d'écriture » toggle on mobile, so
 * PrimaryColumn passes that button here). The expandable filters
 * content still unfurls full-width below the row.
 */
export default function MobileFilters({ trailing }: { trailing?: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-[12px] text-muted transition-colors hover:text-ink"
        >
          {open ? '− ' : '+ '}
          {t('journal.side.filtersToggle')}
        </button>
        {trailing}
      </div>
      {open ? (
        <div className="mt-3">
          <FiltersContent />
        </div>
      ) : null}
    </div>
  );
}
