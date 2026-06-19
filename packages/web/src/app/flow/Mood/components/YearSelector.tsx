import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import { useMoodData, useMoodFilters } from '../context';

/**
 * Year tab strip — leftmost is « En cours » (rolling 52 weeks),
 * followed by every year present in the dataset (descending). Tabs
 * wrap on small viewports.
 *
 * Reads the current selection from the filters context and the
 * available year list from the data context. The selection setter
 * also resets the month filter (handled inside the provider) so a
 * stale month doesn't silently empty the entry list when jumping
 * years.
 */
export default function YearSelector() {
  const { t } = useI18n();
  const { availableYears } = useMoodData();
  const { year, setYear } = useMoodFilters();

  return (
    <div role="tablist" aria-label={t('mood.selectors.yearAria')} className="flex flex-wrap gap-1">
      <button
        type="button"
        role="tab"
        aria-selected={year === null}
        onClick={() => setYear(null)}
        className={cn(
          'cursor-pointer rounded px-2.5 py-1 text-[12px] transition-colors',
          year === null
            ? 'bg-accent-soft font-semibold text-accent-deep'
            : 'text-muted hover:bg-bg-2 hover:text-ink',
        )}
      >
        {t('mood.primary.yearRolling')}
      </button>
      {availableYears.map((y) => {
        const active = y === year;
        return (
          <button
            key={y}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setYear(y)}
            className={cn(
              'cursor-pointer rounded px-2.5 py-1 text-[12px] tabular-nums transition-colors',
              active
                ? 'bg-accent-soft font-semibold text-accent-deep'
                : 'text-muted hover:bg-bg-2 hover:text-ink',
            )}
          >
            {y}
          </button>
        );
      })}
    </div>
  );
}
