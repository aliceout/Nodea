/**
 * Cycle year strip — a thin wrapper over the shared `YearSelector`
 * (recent-years chips + an « earlier » dropdown), passing Cycle's labels.
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';
import YearSelector from '@/ui/dirk/module/YearSelector';

interface Props {
  year: number | null;
  availableYears: readonly number[];
  onChange: (year: number | null) => void;
}

export default function CycleYearSelector({ year, availableYears, onChange }: Props) {
  const { t } = useI18n();
  return (
    <YearSelector
      year={year}
      availableYears={availableYears}
      onChange={onChange}
      rollingLabel={t('cycle.selectors.yearRolling')}
      ariaLabel={t('cycle.selectors.yearAria')}
    />
  );
}
