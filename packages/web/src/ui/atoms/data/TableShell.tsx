import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import Surface, { type SurfaceTone } from '@/ui/atoms/layout/Surface';

export interface TableShellProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tone?: SurfaceTone;
  className?: string;
  children?: ReactNode;
}

function injectTableClass(node: ReactNode): ReactNode {
  if (!isValidElement(node)) return node;
  if (typeof node.type === 'string' && node.type === 'table') {
    const el = node as ReactElement<{ className?: string }>;
    return cloneElement(el, {
      className: clsx(
        'w-full border-collapse text-left text-sm text-[var(--text-secondary)]',
        el.props.className,
      ),
    });
  }
  return node;
}

/**
 * Wrapper around `Surface` tailored for tables: handles the header
 * (title + description + actions), the horizontal scroll container,
 * and injects a baseline className on any direct `<table>` child.
 */
export default function TableShell({
  title = null,
  description = null,
  actions = null,
  className = '',
  children,
  tone = 'base',
}: TableShellProps) {
  return (
    <Surface
      as="section"
      padding="none"
      border="minimal"
      tone={tone}
      className={clsx('overflow-hidden', className)}
    >
      {title || description || actions ? (
        <div className="flex flex-col gap-2 border-b border-[var(--border-default)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            {title ? (
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
            ) : null}
            {description ? (
              <p className="text-sm text-[var(--text-muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div className="w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-default)]">
          {Children.map(children, injectTableClass)}
        </div>
      </div>
    </Surface>
  );
}
