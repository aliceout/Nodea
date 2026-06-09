import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

export interface FilterEntry<T> {
  value: T;
  label: string;
  count: number;
}

interface FilterRowProps<T> {
  /** Section label, e.g. « Langue ». */
  label: string;
  /** Currently selected value, or null when « Tous » / no filter. */
  active: T | null;
  /** Distinct values harvested from results, with counts. */
  entries: FilterEntry<T>[];
  /** Setter — pass null to clear. */
  onChange: (next: T | null) => void;
}

/**
 * One row of filter chips (Langue / Format / Auteur·ice). The
 * « Tous » chip clears the filter ; clicking the active chip
 * again also clears it. Only one selection per dimension at a
 * time — picking a new chip in the same row replaces the
 * previous.
 */
export default function FilterRow<T>({
  label,
  active,
  entries,
  onChange,
}: FilterRowProps<T>) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1.5 overflow-hidden">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.04em] text-muted">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        <FilterChip
          isActive={active === null}
          onClick={() => onChange(null)}
        >
          {t('library.lookup.filterAll')}
        </FilterChip>
        {entries.map((entry, i) => (
          <FilterChip
            key={i}
            isActive={active === entry.value}
            onClick={() =>
              onChange(active === entry.value ? null : entry.value)
            }
          >
            <span className="truncate">{entry.label}</span>
            <span className="ml-1 text-[10px] tabular-nums opacity-70">
              {entry.count}
            </span>
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

interface FilterChipProps {
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
}

function FilterChip({ isActive, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        'inline-flex max-w-[180px] cursor-pointer items-center rounded-sm px-1.5 py-0.5 text-[11px] transition-colors',
        isActive
          ? 'bg-accent-soft font-semibold text-accent-deep'
          : 'text-muted hover:bg-bg hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
