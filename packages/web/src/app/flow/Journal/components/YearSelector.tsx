/**
 * Journal year strip — reads the filters + data contexts and renders the
 * shared `YearSelector` (recent-years chips + an « earlier » dropdown). The
 * `-mt-1` lines the chip TEXT up with the sidebar's first SectionLabel across
 * the grid (same fix as Mood's selector).
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';
import SharedYearSelector from '@/ui/dirk/module/YearSelector';

import { useJournalData, useJournalFilters } from '../context';

export default function YearSelector() {
  const { t } = useI18n();
  const { availableYears } = useJournalData();
  const { year, setYear } = useJournalFilters();
  return (
    <SharedYearSelector
      year={year}
      availableYears={availableYears}
      onChange={setYear}
      rollingLabel={t('journal.primary.yearRolling')}
      ariaLabel={t('journal.primary.yearAria')}
      className="-mt-1"
    />
  );
}
