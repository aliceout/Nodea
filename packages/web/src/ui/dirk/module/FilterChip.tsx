import { cn } from '@/lib/utils';

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  label: string;
  /** Optional count rendered after the label as a muted suffix
   *  (« Ouverts 4 », « Done 12 »). */
  count?: number;
}

/**
 * Pill-style toggle used inside SideColumn filter blocks (Goals
 * status, Library status, Journal threads, etc.). The active
 * state lifts the chip with the sage-soft background; the
 * inactive state stays muted and quiet so a column of chips reads
 * as a single composed control instead of a list of buttons each
 * fighting for attention.
 */
export default function FilterChip({ active, onClick, label, count }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'cursor-pointer rounded-md px-2.5 py-1 text-[12px] tabular-nums transition-colors',
        active
          ? 'bg-accent-soft font-semibold text-accent-deep'
          : 'text-muted hover:bg-bg-2 hover:text-ink',
      )}
    >
      {label}
      {count !== undefined ? (
        <span className="ml-1.5 text-[11px] text-muted">{count}</span>
      ) : null}
    </button>
  );
}
