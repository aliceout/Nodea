/**
 * Month tab strip — « Tous » then the 12 months, shown only when a
 * specific year is selected (the rolling window straddles months by
 * design). Filters the entries list. Same posture as Mood's
 * MonthSelector, props-driven.
 */
import { useMemo } from 'react';
import { getMonthNames } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

interface Props {
  month: number | null;
  onChange: (month: number | null) => void;
}

export default function CycleMonthSelector({ month, onChange }: Props) {
  const { t, language } = useI18n();
  const monthNamesShort = useMemo(() => getMonthNames(language, 'short'), [language]);

  return (
    <div
      role="tablist"
      aria-label={t('cycle.selectors.monthAria')}
      className="flex flex-wrap gap-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={month === null}
        onClick={() => onChange(null)}
        className={cn(
          'cursor-pointer rounded px-2 py-0.5 text-[11px] transition-colors',
          month === null
            ? 'bg-accent-soft font-semibold text-accent-deep'
            : 'text-muted hover:bg-bg-2 hover:text-ink',
        )}
      >
        {t('cycle.selectors.monthAll')}
      </button>
      {monthNamesShort.map((label, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={month === i}
          onClick={() => onChange(i)}
          className={cn(
            'cursor-pointer rounded px-2 py-0.5 text-[11px] capitalize transition-colors',
            month === i
              ? 'bg-accent-soft font-semibold text-accent-deep'
              : 'text-muted hover:bg-bg-2 hover:text-ink',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
