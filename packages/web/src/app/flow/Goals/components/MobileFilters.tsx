import { useI18n } from '@/i18n/I18nProvider.jsx';
import CollapsibleFiltersToggle from '@/ui/dirk/module/CollapsibleFiltersToggle';

import { FiltersContent } from './SideColumn';

/**
 * Mobile-only Filters toggle for Goals — thin binding over the shared
 * `CollapsibleFiltersToggle`. The `-mt-3.5 mb-[18px]` wrapper halves the
 * grid's `py-7` above and sets the space below (the index wraps this +
 * the content in one grid cell, so no grid gap sits between them).
 */
export default function MobileFilters() {
  const { t } = useI18n();
  return (
    <CollapsibleFiltersToggle
      label={t('goals.side.filtersToggle')}
      className="-mt-3.5 mb-[18px] lg:hidden"
    >
      <FiltersContent />
    </CollapsibleFiltersToggle>
  );
}
