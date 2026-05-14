import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Tone-tagged banner displayed under a form row after a save /
 *  delete / import / export attempt. Errors are announced via
 *  `role="alert"` so screen readers pick them up immediately ;
 *  successes use `role="status"` (polite). */
export default function Feedback({
  tone,
  children,
}: {
  tone: 'success' | 'error';
  children: ReactNode;
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'mt-3 border-l-2 px-3 py-1.5 text-[12.5px]',
        tone === 'error'
          ? 'border-danger bg-danger/5 text-danger'
          : 'border-accent bg-accent-soft text-accent-deep',
      )}
    >
      {children}
    </p>
  );
}
