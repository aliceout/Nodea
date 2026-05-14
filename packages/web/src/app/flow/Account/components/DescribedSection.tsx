import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface DescribedSectionProps {
  title: string;
  /** Plain string, or arbitrary JSX when the descriptor needs
   *  inline emphasis (status line + advice in different weights,
   *  see Passkey + TOTP sections). */
  description: ReactNode;
  /** Width of the left control column at `lg+`. Security rows
   *  fit a `Button` (170 px) ; Preferences rows hold a
   *  `<select>` (200 px). */
  controlWidth?: 170 | 200;
  /** Cross-axis alignment at `lg+`. `start` for buttons whose
   *  descriptor wraps over multiple lines (Security tab),
   *  `center` for single-line selects (Preferences). */
  align?: 'start' | 'center';
  children: ReactNode;
}

/**
 * Account row with a heading, a 2-column body (control on the
 * left, single 12 px descriptor on the right), and shared chrome :
 * top / bottom 24 px padding, no padding at the edges (`first:pt-0
 * last:pb-0`), single hairline divider between rows. The left
 * column has a fixed width shared across every row inside one
 * tab so the descriptors line up on the same vertical line
 * regardless of each control's natural width — alignment shouldn't
 * jiggle from « Activer » to « Renouveler la clé ». Below `lg`,
 * columns stack (control first, descriptor under it).
 */
export default function DescribedSection({
  title,
  description,
  controlWidth = 170,
  align = 'start',
  children,
}: DescribedSectionProps) {
  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">{title}</h3>
      <div
        className={cn(
          'grid grid-cols-1 gap-y-3 lg:gap-x-6',
          align === 'center' ? 'items-center' : 'items-start',
          controlWidth === 200 ? 'lg:grid-cols-[200px_1fr]' : 'lg:grid-cols-[170px_1fr]',
        )}
      >
        <div>{children}</div>
        <p className="text-[12px] leading-[1.55] text-muted">{description}</p>
      </div>
    </section>
  );
}
