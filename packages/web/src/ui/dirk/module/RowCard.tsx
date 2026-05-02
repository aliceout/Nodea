import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RowCardProps {
  /** Render as `<li>` (default) when sitting inside a `<ul>`, `<div>`
   *  when standalone. Other element types accepted but rarely
   *  needed. */
  as?: ElementType;
  /** Layout-only className (margin / width). Visual chrome
   *  (rounded, border, bg, padding) is owned by the atom. */
  className?: string;
  children: ReactNode;
}

/**
 * Boxed row container — Direction K · Sauge.
 *
 * `rounded-md border border-hair bg-bg-2 p-3` — the muted card
 * shape used as a list item or a standalone block. Notably:
 *   - Passkeys list rows
 *   - Totp backup-codes display + secret reveal block
 *   - Recover / RecoveryCode mnemonic display blocks
 *
 * Each call site used to inline the same chrome with only the
 * outer element (`<li>` vs `<div>`) and the layout margin
 * (`mb-4`, etc.) varying.
 */
export default function RowCard({
  as: Tag = 'li',
  className,
  children,
}: RowCardProps) {
  return (
    <Tag
      className={cn(
        'rounded-md border border-hair bg-bg-2 p-3',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
