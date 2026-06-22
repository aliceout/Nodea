import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
  /**
   * `eyebrow` (default) — 11 px uppercase, used by the Mood composer's
   * inline form sections. `section` — 12 px, not uppercased, a touch
   * more bottom margin: the SideColumn filter headers (Mood / Journal /
   * Goals / Library), factored from four byte-identical local copies.
   */
  variant?: 'eyebrow' | 'section';
}

/**
 * Small muted section header — semibold, with a touch of letter-spacing
 * so it reads as a label rather than body copy. Direction K · Sauge
 * baseline. Two tones via `variant` (see prop).
 */
export default function SectionLabel({
  children,
  className,
  variant = 'eyebrow',
}: SectionLabelProps) {
  return (
    <div
      className={cn(
        variant === 'section'
          ? 'mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted'
          : 'mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted',
        className,
      )}
    >
      {children}
    </div>
  );
}
