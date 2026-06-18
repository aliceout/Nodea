import { createElement, type ElementType, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type SurfaceTone = 'base' | 'muted' | 'subtle' | 'inverse';
export type SurfaceBorder = 'default' | 'strong' | 'minimal';
export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';
export type SurfaceRadius = 'sm' | 'md' | 'lg';
export type SurfaceShadow = 'none' | 'sm' | 'md';

export interface SurfaceProps {
  /**
   * The DOM element rendered at the root. Defaults to `"section"`.
   * Kept loose (`ElementType`) so callers can pass `aside`, `li`,
   * `article`, or a custom component without fighting the types.
   */
  as?: ElementType;
  tone?: SurfaceTone;
  border?: SurfaceBorder;
  padding?: SurfacePadding;
  radius?: SurfaceRadius;
  shadow?: SurfaceShadow;
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
  /**
   * Extra attributes forwarded to the root (id, role, data-attrs, …).
   * Kept as an untyped bag because the root is polymorphic — we trade
   * exhaustive typing for the same flexibility the JSX version had.
   */
  [key: string]: unknown;
}

const toneClasses: Record<SurfaceTone, string> = {
  base: 'bg-[var(--surface-default)] text-[var(--text-primary)]',
  muted: 'bg-[var(--surface-muted)] text-[var(--text-primary)]',
  subtle: 'bg-[var(--surface-subtle)] text-[var(--text-primary)]',
  inverse: 'bg-[var(--surface-inverse)] text-[var(--text-inverse)]',
};

const paddingClasses: Record<SurfacePadding, string> = {
  none: 'gap-0 p-0',
  sm: 'gap-[var(--surface-gap-sm)] p-[var(--surface-padding-sm)]',
  md: 'gap-[var(--surface-gap-md)] p-[var(--surface-padding-md)]',
  lg: 'gap-[var(--surface-gap-lg)] p-[var(--surface-padding-lg)]',
};

const radiusClasses: Record<SurfaceRadius, string> = {
  sm: 'rounded-[var(--radius-sm)]',
  md: 'rounded-[var(--radius-md)]',
  lg: 'rounded-[var(--radius-lg)]',
};

const shadowBase: Record<SurfaceShadow, string> = {
  none: 'shadow-none',
  sm: 'shadow-[var(--shadow-xs)]',
  md: 'shadow-[var(--shadow-md)]',
};

const hoverShadow: Record<SurfaceShadow, string> = {
  none: 'hover:shadow-none',
  sm: 'hover:shadow-[var(--shadow-sm)]',
  md: 'hover:shadow-[var(--shadow-md)]',
};

export default function Surface({
  as,
  tone = 'base',
  border = 'default',
  padding = 'md',
  radius = 'lg',
  shadow = 'sm',
  interactive = false,
  className = '',
  children,
  ...props
}: SurfaceProps) {
  const Component = as ?? 'section';
  const isMinimalBorder = border === 'minimal';

  const borderClassName =
    border === 'strong'
      ? 'border border-[var(--border-strong)]'
      : border === 'minimal'
        ? 'border border-transparent'
        : tone === 'inverse'
          ? 'border border-[var(--border-inverse)]'
          : 'border border-[var(--border-default)]';

  const shadowClassName = isMinimalBorder ? 'shadow-none' : shadowBase[shadow];

  const interactiveShadowClass =
    interactive && !isMinimalBorder
      ? hoverShadow[shadow]
      : interactive
        ? 'hover:shadow-none'
        : '';

  return createElement(
    Component,
    {
      ...props,
      className: cn(
        'surface flex flex-col transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out',
        toneClasses[tone],
        borderClassName,
        paddingClasses[padding],
        radiusClasses[radius],
        shadowClassName,
        interactiveShadowClass,
        interactive ? 'cursor-pointer hover:-translate-y-[1px]' : '',
        className,
      ),
    },
    children,
  );
}
