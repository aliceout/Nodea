import { useI18n } from '@/i18n/I18nProvider.jsx';
import FilterChip from '@/ui/dirk/module/FilterChip';

import { LIBRARY_VIEW_MODES, useLibraryFilters } from '../context';

/** Catalogue rendering-mode picker — five `FilterChip`s so it stacks
 *  cleanly with the other sidebar sections (« Grouper par »,
 *  « Statut », « Tags ») which all use the same chip atom. Labels
 *  resolve from `library.viewMode.*`. Reads `viewMode` /
 *  `setViewMode` from the filters context ; no props. */
// « Tableau » (`table`) leads the picker; the rest keep their order.
// Display-only — `LIBRARY_VIEW_MODES` stays the canonical tuple used
// for default-clamping / persistence.
const VIEW_MODE_ORDER: ReadonlyArray<(typeof LIBRARY_VIEW_MODES)[number]> = [
  'table',
  ...LIBRARY_VIEW_MODES.filter((m) => m !== 'table'),
];

export default function ViewModeToggle() {
  const { t } = useI18n();
  const { viewMode, setViewMode } = useLibraryFilters();
  return (
    <div className="flex flex-wrap gap-1">
      {VIEW_MODE_ORDER.map((id) => (
        <FilterChip
          key={id}
          active={viewMode === id}
          onClick={() => setViewMode(id)}
          label={t(`library.viewMode.${id}`)}
        />
      ))}
    </div>
  );
}
