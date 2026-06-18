/**
 * CollapseToggle — the chevron button that folds / unfolds a section:
 * the chevron points up when open and flips down when collapsed. Shared
 * across modules (HRT schedules + dose/lab charts, Mood / Journal frise)
 * so the affordance reads identically everywhere; lives in `ui/dirk/
 * module/` next to the other cross-module surface atoms.
 */
import { ChevronUpIcon } from '@heroicons/react/24/outline';

import { cn } from '@/lib/utils';

interface CollapseToggleProps {
  open: boolean;
  onToggle: () => void;
  /** Visible label + accessible name, e.g. « Masquer le graphique ». */
  label: string;
  className?: string;
}

export default function CollapseToggle({ open, onToggle, label, className }: CollapseToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-[11.5px] text-muted transition-colors hover:bg-bg-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
        className,
      )}
    >
      <span>{label}</span>
      <ChevronUpIcon
        className={cn('h-3.5 w-3.5 transition-transform duration-200', !open && 'rotate-180')}
        aria-hidden="true"
      />
    </button>
  );
}
