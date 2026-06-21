import { XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Dismissible active-filter chip — a pill showing a *currently applied*
 * filter value with a cross to clear it (distinct from {@link FilterChip},
 * which is a toggle that *picks* a filter). Lives in `ui/dirk/module`
 * because several modules surface the same affordance — Mood's day /
 * score filters, and Journal's day filter mirror it. Factored out of
 * Mood's `PrimaryColumn`, where it was inlined twice (REFACTO-08).
 *
 * Clicking anywhere on the chip clears the filter — the whole pill is
 * the target, the cross is just the affordance. Pass `ariaLabel` since
 * the visible label is the value, not the action.
 */
interface ActiveFilterChipProps {
  /** The active value to display (e.g. a formatted date or score). */
  label: string;
  /** Clear the filter this chip represents. */
  onClear: () => void;
  /** Native tooltip on hover. */
  title?: string;
  /** Accessible name for the clear action (the label is the value). */
  ariaLabel?: string;
}

export default function ActiveFilterChip({
  label,
  onClear,
  title,
  ariaLabel,
}: ActiveFilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClear}
      {...(title ? { title } : {})}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-hair bg-bg-2 px-2 py-0.5 text-[11px] text-ink-soft transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span>{label}</span>
      <XMarkIcon className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}
