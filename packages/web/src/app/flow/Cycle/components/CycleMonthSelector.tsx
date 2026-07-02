/**
 * Cycle month strip — a thin wrapper over the shared `MonthSelector`,
 * passing Cycle's labels. Shown only when a specific year is selected.
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';
import MonthSelector from '@/ui/dirk/module/MonthSelector';

interface Props {
  month: number | null;
  onChange: (month: number | null) => void;
}

export default function CycleMonthSelector({ month, onChange }: Props) {
  const { t } = useI18n();
  return (
    <MonthSelector
      month={month}
      onChange={onChange}
      allLabel={t('cycle.selectors.monthAll')}
      ariaLabel={t('cycle.selectors.monthAria')}
    />
  );
}
