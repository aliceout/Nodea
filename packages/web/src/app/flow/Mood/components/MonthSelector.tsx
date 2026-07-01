/**
 * Mood month strip — reads the filters context and renders the shared
 * `MonthSelector`. Shown to the right of the « Entrées · … » heading when a
 * specific year is selected (hidden in « En cours » mode).
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';
import SharedMonthSelector from '@/ui/dirk/module/MonthSelector';

import { useMoodFilters } from '../context';

export default function MonthSelector() {
  const { t } = useI18n();
  const { month, setMonth } = useMoodFilters();
  return (
    <SharedMonthSelector
      month={month}
      onChange={setMonth}
      allLabel={t('mood.selectors.monthAll')}
      ariaLabel={t('mood.selectors.monthAria')}
    />
  );
}
