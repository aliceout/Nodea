/**
 * HRT — label + control + inline error wrapper, mirroring the `Field`
 * atom's markup for controls that aren't a bare `<input>` (`Select`,
 * `Textarea`). Shared by both module forms so the two stay
 * pixel-aligned with `Field`.
 */
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface FieldRowProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  /** Extra classes on the wrapper (e.g. `sm:col-span-2` in a grid). */
  className?: string;
  children: ReactNode;
}

export default function FieldRow({ label, htmlFor, error, className, children }: FieldRowProps) {
  return (
    <div className={cn('mb-3.5', className)}>
      <label htmlFor={htmlFor} className="mb-1.25 block text-[12px] font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
