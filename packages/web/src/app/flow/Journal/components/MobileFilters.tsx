import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import CollapsibleFiltersToggle from '@/ui/dirk/module/CollapsibleFiltersToggle';

import { FiltersContent } from './SideColumn';

/**
 * Mobile-only Filters toggle for Journal — thin binding over the shared
 * `CollapsibleFiltersToggle`. `trailing` is the « carte d'écriture »
 * toggle PrimaryColumn shares on the toggle row at mobile widths.
 */
export default function MobileFilters({ trailing }: { trailing?: ReactNode }) {
  const { t } = useI18n();
  return (
    <CollapsibleFiltersToggle
      label={t('journal.side.filtersToggle')}
      {...(trailing !== undefined ? { trailing } : {})}
    >
      <FiltersContent />
    </CollapsibleFiltersToggle>
  );
}
