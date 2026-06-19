import { useMemo } from 'react';

import { getMonthNames } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import { useMoodFilters } from '../context';

/**
 * Month tab strip rendered to the right of the « Entrées · … »
 * heading when a specific year is selected. Hidden in « En cours »
 * mode because the rolling 52-week window straddles months by
 * design.
 *
 * `null` = « Tous » ; selecting a month restricts the entry list
 * (the heatmap above stays full-year, only the list below filters
 * down).
 */
export default function MonthSelector() {
  const { t, language } = useI18n();
  const { month, setMonth } = useMoodFilters();
  const monthNamesShort = useMemo(
    () => getMonthNames(language, 'short'),
    [language],
  );

  return (
    <div role="tablist" aria-label={t('mood.selectors.monthAria')} className="flex flex-wrap gap-1">
      <button
        type="button"
        role="tab"
        aria-selected={month === null}
        onClick={() => setMonth(null)}
        className={cn(
          'cursor-pointer rounded px-2 py-0.5 text-[11px] transition-colors',
          month === null
            ? 'bg-accent-soft font-semibold text-accent-deep'
            : 'text-muted hover:bg-bg-2 hover:text-ink',
        )}
      >
        {t('mood.selectors.monthAll')}
      </button>
      {monthNamesShort.map((label, i) => {
        const active = month === i;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMonth(i)}
            className={cn(
              'cursor-pointer rounded px-2 py-0.5 text-[11px] transition-colors',
              active
                ? 'bg-accent-soft font-semibold text-accent-deep'
                : 'text-muted hover:bg-bg-2 hover:text-ink',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
