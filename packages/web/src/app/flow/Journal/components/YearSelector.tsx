import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import { useJournalData, useJournalFilters } from '../context';

/**
 * Year tab strip for Journal — leftmost is « En cours » (rolling
 * 52 weeks ending today), followed by every year present in the
 * dataset (descending). Same surface as Mood's `YearSelector`.
 *
 * Reads the current selection from the filters context and the
 * available year list from the data context. The selection both
 * narrows the entries list AND retargets the heatmap range : null
 * keeps the rolling-year view, a year jumps to its January-to-
 * December slice.
 */
export default function YearSelector() {
  const { t } = useI18n();
  const { availableYears } = useJournalData();
  const { year, setYear } = useJournalFilters();

  return (
    <div
      role="tablist"
      aria-label={t('journal.primary.yearAria')}
      className="flex flex-wrap gap-1"
    >
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
        {t('journal.primary.yearRolling')}
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
