import clsx from 'clsx';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  align?: 'start' | 'center';
  spacing?: 'default' | 'tight';
}

export default function SectionHeader({
  title,
  description,
  actions = null,
  className = '',
  align = 'start',
  spacing = 'default',
}: SectionHeaderProps) {
  const baseGap = spacing === 'tight' ? 'gap-1.5' : 'gap-2';

  return (
    <div
      className={clsx(
        'flex flex-col',
        baseGap,
        actions ? 'sm:flex-row sm:items-center sm:justify-between sm:gap-4' : '',
        align === 'center' ? 'text-center sm:text-left' : '',
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        {title ? (
          <h2 className="text-lg font-semibold leading-tight text-[var(--text-primary)]">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
