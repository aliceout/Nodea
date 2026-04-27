import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'neutral'
  | 'ghost'
  | 'danger'
  | 'danger-outline'
  | 'danger-ghost';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square aspect for icon-only buttons (no horizontal padding,
   *  width = height). Use with a single Heroicon child. */
  iconOnly?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * K · Sauge button — single source of truth for every clickable
 * surface in the app.
 *
 * Variants cover the seven roles we use:
 *   - **primary** : filled sage — dominant CTA (Login, Save…)
 *   - **secondary** : sage outline — siblings of primary
 *   - **neutral** : hair-bordered — back / cancel / less-emphatic
 *   - **ghost** : transparent — toolbar / chrome buttons
 *   - **danger** : filled red — destructive CTA
 *   - **danger-outline** : red border — secondary destructive
 *   - **danger-ghost** : transparent until hover — minor delete /
 *     remove icons in lists
 *
 * Sizes adapt to context: `xs` for inline list actions, `sm` for
 * toolbars, `md` for forms (default), `lg` for marketing / auth.
 *
 * Use `iconOnly` to switch to a square aspect ratio when the only
 * child is an icon — keeps icon buttons aligned with text buttons
 * of the same `size`.
 */
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover active:translate-y-px',
  secondary:
    'border border-accent bg-transparent text-accent hover:bg-accent/5 hover:text-accent-deep',
  neutral:
    'border border-hair bg-bg text-ink hover:bg-bg-2',
  ghost:
    'bg-transparent text-muted hover:bg-bg-2 hover:text-ink',
  danger:
    'bg-danger text-white hover:bg-danger/90 active:translate-y-px',
  'danger-outline':
    'border border-danger bg-transparent text-danger hover:bg-danger/5',
  'danger-ghost':
    'bg-transparent text-muted hover:bg-danger/10 hover:text-danger',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-[11px]',
  sm: 'h-8 px-3 text-[12px]',
  md: 'h-9 px-4 text-[13px]',
  lg: 'h-11 px-4 text-[14px]',
};

const ICON_SIZE_CLASS: Record<ButtonSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  className,
  type = 'button',
  children,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md font-semibold',
        'transition-[background-color,transform,color] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-60',
        iconOnly ? ICON_SIZE_CLASS[size] : SIZE_CLASS[size],
        VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
