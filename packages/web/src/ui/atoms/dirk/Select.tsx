import type { ReactNode, Ref, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children?: ReactNode;
  ref?: Ref<HTMLSelectElement>;
}

/**
 * K · Sauge select — same height (`h-8`) and rounding
 * (`--radius-input`) as the dirk Input so the two align in inline
 * rows (e.g. the lookup bar's language picker next to the search
 * input, or the Status / Format / Tags row on a book form).
 *
 * Forwards every native select attribute. Pass options as children.
 * Padding is slightly tighter (`px-2`) than Input so the dropdown
 * arrow doesn't push the visible value off-centre.
 */
export default function Select({ className, children, ref, ...props }: SelectProps) {
  return (
    <select
      ref={ref}
      className={cn(
        // `shrink-0` for the same reason as DirkInput: prevents the
        // flex-col modal body from squeezing standalone selects
        // below their declared `h-8` when content overflows.
        'block h-8 w-full shrink-0 cursor-pointer rounded-[var(--radius-input)] border border-hair bg-bg px-2 text-[12.5px] text-ink',
        'focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
