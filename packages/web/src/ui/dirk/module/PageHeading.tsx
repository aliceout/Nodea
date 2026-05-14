import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeadingProps {
  children: ReactNode;
  className?: string;
}

/**
 * H1 of a module / page surface — 30 px serif-influenced sans,
 * tight tracking, hairline mb-6 to its body. Direction K · Sauge
 * baseline shared by Mood / Journal / Goals / Library / Homepage.
 *
 * The mb-6 is part of the spec but every site needs to override it
 * occasionally (sticky wrappers, reduced-margin headers); pass a
 * `className` to add or replace.
 */
export default function PageHeading({ children, className }: PageHeadingProps) {
  return (
    <h1
      className={cn(
        'mb-6 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink',
        className,
      )}
    >
      {children}
    </h1>
  );
}
