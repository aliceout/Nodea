import type { ElementType, ReactNode } from 'react';
import Surface, {
  type SurfaceBorder,
  type SurfacePadding,
  type SurfaceRadius,
  type SurfaceShadow,
  type SurfaceTone,
} from '@/ui/atoms/layout/Surface';

export interface SurfaceCardProps {
  as?: ElementType;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: SurfaceTone;
  border?: SurfaceBorder;
  padding?: SurfacePadding;
  radius?: SurfaceRadius;
  shadow?: SurfaceShadow;
  interactive?: boolean;
  /** Extra attributes forwarded to the Surface root (same rationale as Surface). */
  [key: string]: unknown;
}

/**
 * Surface with a built-in title/description header and an inner body
 * wrapper. Thin convenience layer — everything passes through to Surface.
 */
export default function SurfaceCard({
  title,
  description,
  children,
  className = '',
  bodyClassName = '',
  as = 'section',
  tone = 'base',
  border = 'default',
  padding = 'md',
  radius = 'lg',
  shadow = 'sm',
  interactive = false,
  ...props
}: SurfaceCardProps) {
  return (
    <Surface
      as={as}
      tone={tone}
      border={border}
      padding={padding}
      radius={radius}
      shadow={shadow}
      interactive={interactive}
      className={className}
      {...props}
    >
      {title || description ? (
        <header className="flex flex-col gap-1">
          {title ? (
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
          ) : null}
          {description ? (
            <p className="text-sm text-[var(--text-muted)]">{description}</p>
          ) : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </Surface>
  );
}
