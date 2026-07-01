/**
 * Year tab strip — « En cours » (rolling) then every year present in
 * the data, descending. Same posture as Mood's YearSelector, but reads
 * props (Cycle keeps its filter state in the page, no context).
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

interface Props {
  year: number | null;
  availableYears: readonly number[];
  onChange: (year: number | null) => void;
}

export default function CycleYearSelector({ year, availableYears, onChange }: Props) {
  const { t } = useI18n();
  return (
    <div
      role="tablist"
      aria-label={t('cycle.selectors.yearAria')}
      className="-mt-1 flex flex-wrap gap-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={year === null}
        onClick={() => onChange(null)}
        className={cn(
          'cursor-pointer rounded px-2.5 py-1 text-[12px] transition-colors',
          year === null
            ? 'bg-accent-soft font-semibold text-accent-deep'
            : 'text-muted hover:bg-bg-2 hover:text-ink',
        )}
      >
        {t('cycle.selectors.yearRolling')}
      </button>
      {availableYears.map((y) => (
        <button
          key={y}
          type="button"
          role="tab"
          aria-selected={y === year}
          onClick={() => onChange(y)}
          className={cn(
            'cursor-pointer rounded px-2.5 py-1 text-[12px] tabular-nums transition-colors',
            y === year
              ? 'bg-accent-soft font-semibold text-accent-deep'
              : 'text-muted hover:bg-bg-2 hover:text-ink',
          )}
        >
          {y}
        </button>
      ))}
    </div>
  );
}
