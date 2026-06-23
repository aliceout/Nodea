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
  /**
   * Optional right-aligned slot on the header line — e.g. a « Gérer les
   * fils / thèmes » manage link (see `ManageLink`). When set, the header
   * becomes a `justify-between` row so the action sits at the far right
   * on the same baseline as the label.
   */
  action?: ReactNode;
}

const TEXT_CLASSES: Record<NonNullable<SectionLabelProps['variant']>, string> = {
  section: 'text-[12px] font-semibold tracking-[0.02em] text-muted',
  eyebrow: 'text-[11px] font-semibold uppercase tracking-[0.04em] text-muted',
};
const MARGIN_CLASSES: Record<NonNullable<SectionLabelProps['variant']>, string> = {
  section: 'mb-2.5',
  eyebrow: 'mb-1.5',
};

/**
 * Small muted section header — semibold, with a touch of letter-spacing
 * so it reads as a label rather than body copy. Direction K · Sauge
 * baseline. Two tones via `variant` (see prop). An optional `action`
 * slot puts a control (manage link) on the right of the header line.
 */
export default function SectionLabel({
  children,
  className,
  variant = 'eyebrow',
  action,
}: SectionLabelProps) {
  if (action) {
    return (
      <div className={cn(MARGIN_CLASSES[variant], 'flex items-center justify-between gap-2', className)}>
        <span className={TEXT_CLASSES[variant]}>{children}</span>
        {action}
      </div>
    );
  }
  return (
    <div className={cn(MARGIN_CLASSES[variant], TEXT_CLASSES[variant], className)}>
      {children}
    </div>
  );
}
