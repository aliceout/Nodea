import { useMemo } from 'react';

import { getMonthNames } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

/**
 * Shared month tab strip (« Tous » + the 12 months) for every module's header
 * (Mood · Journal · Cycle), shown when a specific year is selected. `null` =
 * « Tous » ; month is 0-indexed. Props-driven — the context-bound modules pass
 * their own `{ month, setMonth }` + labels through a thin wrapper. Month names
 * come from `Intl` (locale-aware, no FR hardcoding).
 */
interface Props {
  month: number | null; // 0-indexed
  onChange: (month: number | null) => void;
  allLabel: string;
  ariaLabel: string;
  className?: string;
}

const chip = (active: boolean) =>
  cn(
    'cursor-pointer rounded px-2 py-0.5 text-[11px] transition-colors',
    active
      ? 'bg-accent-soft font-semibold text-accent-deep'
      : 'text-muted hover:bg-bg-2 hover:text-ink',
  );

export default function MonthSelector({
  month,
  onChange,
  allLabel,
  ariaLabel,
  className,
}: Props) {
  const { language } = useI18n();
  const names = useMemo(() => getMonthNames(language, 'short'), [language]);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap gap-1', className)}
    >
      <button
        type="button"
        role="tab"
        aria-selected={month === null}
        onClick={() => onChange(null)}
        className={chip(month === null)}
      >
        {allLabel}
      </button>
      {names.map((label, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={month === i}
          onClick={() => onChange(i)}
          className={cn(chip(month === i), 'capitalize')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
