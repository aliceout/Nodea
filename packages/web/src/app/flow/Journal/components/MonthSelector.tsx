import { useMemo } from 'react';

import { getMonthNames } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import { useJournalFilters } from '../context';

/**
 * Month tab strip shown next to the frise toggle when a specific
 * year is selected. `null` = « Tous » ; picking a month narrows the
 * entry list to that month of the year (the heatmap above stays
 * full-year). Hidden in « En cours » mode — the rolling window
 * straddles months by design.
 *
 * ponytail: a near-twin of Mood's `MonthSelector` (same tab strip,
 * different filters context). Two copies is under the « third copy »
 * line ; factor a shared `MonthTabs` taking { month, setMonth } if a
 * third module needs it.
 */
export default function MonthSelector() {
  const { t, language } = useI18n();
  const { month, setMonth } = useJournalFilters();
  const monthNamesShort = useMemo(
    () => getMonthNames(language, 'short'),
    [language],
  );

  return (
    <div
      role="tablist"
      aria-label={t('journal.selectors.monthAria')}
      className="flex flex-wrap gap-1"
    >
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
        {t('journal.selectors.monthAll')}
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
