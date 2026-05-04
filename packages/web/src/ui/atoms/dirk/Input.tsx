import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Make the field's text centered (used for narrow numeric fields
   * like ISBN year, tome n°). Default left-aligned. */
  align?: 'left' | 'center';
  ref?: Ref<HTMLInputElement>;
}

/**
 * K · Sauge text input — the canonical sizing and chrome for any
 * single-line text field in the dirk design (Composer modals, lookup
 * bars, picker dialogs). Use this rather than rolling another inline
 * `<input className="...">` so heights, padding, and focus rings stay
 * pixel-aligned across the app. The user's last frustration with
 * mismatched input heights came from one screen using `h-9` and the
 * rest `h-8`; centralising the styling here makes that drift impossible.
 *
 * Forwards every native input attribute. Use `align="center"` for
 * numeric / short-string fields where centering reads better. Pass a
 * custom `className` for one-off layout tweaks (width, flex behaviour).
 */
export default function Input({
  align = 'left',
  className,
  ref,
  ...props
}: InputProps) {
  return (
    <input
      ref={ref}
      // Explicit `type="text"` so DOM selectors / e2e tests can target
      // text inputs unambiguously. Caller props win via the spread
      // below — passing `type="password"`, `type="email"` etc. still
      // overrides this default.
      type="text"
      className={cn(
        // `min-h-8` does the anti-squeeze job that an earlier
        // version of this atom delegated to `shrink-0` — without
        // also forbidding *horizontal* shrinking. The original
        // problem: a standalone input inside a `flex flex-col
        // h-[600px]` modal body got squeezed below 32 px when the
        // sum of children exceeded the container. The earlier
        // `shrink-0` fix worked in modals but caused the input to
        // *overflow* its parent in a flex-row context (sidebar
        // footer), since it couldn't relinquish width to siblings.
        // `min-h-8` constrains only the vertical axis, which is
        // the only axis where the squeeze actually mattered.
        'block h-8 min-h-8 w-full rounded-sm border border-hair bg-bg px-3 text-[13px] text-ink placeholder:text-muted-soft',
        'focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60',
        align === 'center' ? 'text-center tabular-nums' : '',
        className,
      )}
      {...props}
    />
  );
}
