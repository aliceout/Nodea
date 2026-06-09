import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
}

/**
 * Small uppercase eyebrow used inside SideColumn / module inline
 * forms / Goals filters as a section header — 11 px, semibold,
 * muted, with a touch of letter-spacing so it reads as a label
 * rather than as body copy. Direction K · Sauge baseline.
 */
export default function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <div
      className={cn(
        'mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted',
        className,
      )}
    >
      {children}
    </div>
  );
}
