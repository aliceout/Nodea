import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyHintProps {
  children: ReactNode;
  className?: string;
}

/**
 * Italic muted hairline-bordered line used as a placeholder when
 * a list is empty or still loading — « Chargement des entrées… »,
 * « Aucune entrée pour cette sélection. ». Sits at the top of the
 * scroll area so the empty state doesn't read as a layout glitch.
 */
export default function EmptyHint({ children, className }: EmptyHintProps) {
  return (
    <p
      className={cn(
        'border-b border-hair py-6 text-[13px] italic text-muted',
        className,
      )}
    >
      {children}
    </p>
  );
}
