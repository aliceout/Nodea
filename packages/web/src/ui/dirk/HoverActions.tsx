import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface HoverActionsProps {
  children: ReactNode;
  className?: string;
}

/**
 * Cluster of icon buttons that stays invisible until the parent
 * row is hovered or focus-within. Used at the right edge of every
 * list row in Mood / Journal / Goals / Library — typically a
 * Pencil edit + a Trash delete, optionally a star toggle.
 *
 * The parent row needs `group` for the hover/focus state to
 * propagate; this atom relies on that contract.
 */
export default function HoverActions({ children, className }: HoverActionsProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity',
        'group-hover:opacity-100 group-focus-within:opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}
