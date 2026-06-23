import { useI18n } from '@/i18n/I18nProvider.jsx';
import FilterChip from '@/ui/dirk/module/FilterChip';

import { useGoalsFilters, type GoalsViewMode } from '../context';

const VIEW_MODES: ReadonlyArray<{ id: GoalsViewMode; labelKey: string; defaultLabel: string }> = [
  { id: 'cards', labelKey: 'goals.viewMode.cards', defaultLabel: 'Cartes' },
  { id: 'list', labelKey: 'goals.viewMode.list', defaultLabel: 'Liste' },
];

/**
 * Goals primary-surface rendering-mode picker — rendered as
 * `FilterChip`s so it stacks cleanly with the other sidebar
 * sections (`Statut`, `Grouper par`, `Trier par`) which all use
 * the same chip atom. Reads `viewMode` / `setViewMode` from the
 * filters context ; no props.
 */
export default function ViewModeToggle() {
  const { t } = useI18n();
  const { viewMode, setViewMode } = useGoalsFilters();
  return (
    <div className="flex flex-wrap gap-1">
      {VIEW_MODES.map(({ id, labelKey, defaultLabel }) => (
        <FilterChip
          key={id}
          active={viewMode === id}
          onClick={() => setViewMode(id)}
          label={t(labelKey, { defaultValue: defaultLabel })}
        />
      ))}
    </div>
  );
}
