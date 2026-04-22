import clsx from 'clsx';
import type { ButtonHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'primarySoft'
  | 'info'
  | 'danger'
  | 'accent'
  | 'secondary'
  | 'ghost'
  | 'ghostDanger'
  | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-nodea-sage-dark text-white hover:bg-nodea-sage-darker focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-nodea-sage-dark',
  primarySoft:
    'bg-nodea-sage text-white hover:bg-nodea-sage-dark focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-nodea-sage',
  info:
    'bg-nodea-sky-dark text-white hover:bg-nodea-sky-darker focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-nodea-sky-dark',
  danger:
    'bg-nodea-blush-dark text-white hover:bg-nodea-blush-darker focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-nodea-blush-dark',
  accent:
    'bg-[var(--accent-primary-strong)] text-white hover:bg-[var(--accent-primary)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-primary-strong)]',
  secondary:
    'border border-[var(--border-default)] bg-[var(--surface-default)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-primary)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2',
  ghostDanger:
    'bg-transparent text-[var(--accent-danger)] hover:text-[var(--accent-danger)]/80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-danger)]',
  link: 'bg-transparent px-0 py-0 text-sm font-semibold text-[var(--accent-primary-strong)] underline underline-offset-2 hover:text-[var(--accent-primary)] focus-visible:ring-0',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-base',
};

interface CommonProps {
  className?: string;
  children?: ReactNode;
  unstyled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

type AsButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    as?: 'button';
    type?: 'button' | 'submit' | 'reset';
  };

type AsLabelProps = CommonProps &
  Omit<LabelHTMLAttributes<HTMLLabelElement>, keyof CommonProps> & {
    as: 'label';
  };

export type ButtonProps = AsButtonProps | AsLabelProps;

function resolveClass(
  variant: ButtonVariant,
  size: ButtonSize,
  unstyled: boolean,
  className: string,
): string {
  if (unstyled) return className;
  return clsx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-150 ease-out focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
    sizeClasses[size],
    variantStyles[variant],
    className,
  );
}

export default function Button(props: ButtonProps) {
  const {
    className = '',
    children,
    unstyled = false,
    variant = 'primary',
    size = 'md',
  } = props;
  const baseClass = resolveClass(variant, size, unstyled, className);

  if (props.as === 'label') {
    const {
      as: _as,
      className: _className,
      children: _children,
      unstyled: _unstyled,
      variant: _variant,
      size: _size,
      ...rest
    } = props;
    void _as;
    void _className;
    void _children;
    void _unstyled;
    void _variant;
    void _size;
    return (
      <label className={baseClass} {...rest}>
        {children}
      </label>
    );
  }

  const {
    as: _as,
    className: _className,
    children: _children,
    unstyled: _unstyled,
    variant: _variant,
    size: _size,
    type = 'button',
    ...rest
  } = props;
  void _as;
  void _className;
  void _children;
  void _unstyled;
  void _variant;
  void _size;

  return (
    <button type={type} className={baseClass} {...rest}>
      {children}
    </button>
  );
}
