import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const BASE =
  'inline-block rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent-deep';

interface TagProps {
  children: ReactNode;
  className?: string;
  /** When set, the tag is a button (e.g. Goals' click-to-cycle status
   *  pill). Omit it for a static label (Journal thread tags). */
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
}

/**
 * Small sage pill used as an inline metadata tag — Journal thread
 * tags, Goals status. One look across modules : `accent-soft`
 * background, `accent-deep` text, 10.5px. Renders a `<span>` by
 * default, or a focusable `<button>` when `onClick` is given.
 */
export default function Tag({
  children,
  className,
  onClick,
  title,
  ariaLabel,
}: TagProps) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
        className={cn(
          BASE,
          'cursor-pointer transition-colors hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          className,
        )}
      >
        {children}
      </button>
    );
  }
  return <span className={cn(BASE, className)}>{children}</span>;
}
