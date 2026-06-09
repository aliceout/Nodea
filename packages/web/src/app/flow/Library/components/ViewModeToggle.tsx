import { useI18n } from '@/i18n/I18nProvider.jsx';
import FilterChip from '@/ui/dirk/module/FilterChip';

import { LIBRARY_VIEW_MODES, useLibraryFilters } from '../context';

/** Catalogue rendering-mode picker — five `FilterChip`s so it stacks
 *  cleanly with the other sidebar sections (« Grouper par »,
 *  « Statut », « Tags ») which all use the same chip atom. Labels
 *  resolve from `library.viewMode.*`. Reads `viewMode` /
 *  `setViewMode` from the filters context ; no props. */
export default function ViewModeToggle() {
  const { t } = useI18n();
  const { viewMode, setViewMode } = useLibraryFilters();
  return (
    <div className="flex flex-wrap gap-1">
      {LIBRARY_VIEW_MODES.map((id) => (
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
