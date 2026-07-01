/**
 * Journal month strip — reads the filters context and renders the shared
 * `MonthSelector`. Shown next to the frise toggle when a specific year is
 * selected (hidden in « En cours » mode).
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';
import SharedMonthSelector from '@/ui/dirk/module/MonthSelector';

import { useJournalFilters } from '../context';

export default function MonthSelector() {
  const { t } = useI18n();
  const { month, setMonth } = useJournalFilters();
  return (
    <SharedMonthSelector
      month={month}
      onChange={setMonth}
      allLabel={t('journal.selectors.monthAll')}
      ariaLabel={t('journal.selectors.monthAria')}
    />
  );
}
