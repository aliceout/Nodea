/**
 * Mood year strip — reads the filters + data contexts and renders the shared
 * `YearSelector` (recent-years chips + an « earlier » dropdown). The `-mt-1`
 * cancels the chips' `py-1` so the tab TEXT lines up with the sidebar's first
 * SectionLabel (« Répartition ») across the grid.
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';
import SharedYearSelector from '@/ui/dirk/module/YearSelector';

import { useMoodData, useMoodFilters } from '../context';

export default function YearSelector() {
  const { t } = useI18n();
  const { availableYears } = useMoodData();
  const { year, setYear } = useMoodFilters();
  return (
    <SharedYearSelector
      year={year}
      availableYears={availableYears}
      onChange={setYear}
      rollingLabel={t('mood.primary.yearRolling')}
      ariaLabel={t('mood.selectors.yearAria')}
      className="-mt-1"
    />
  );
}
