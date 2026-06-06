/**
 * HRT — label + control + inline error wrapper, mirroring the `Field`
 * atom's markup for controls that aren't a bare `<input>` (`Select`,
 * `Textarea`). Shared by both module forms so the two stay
 * pixel-aligned with `Field`.
 */
import type { ReactNode } from 'react';

interface FieldRowProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  children: ReactNode;
}

export default function FieldRow({ label, htmlFor, error, children }: FieldRowProps) {
  return (
    <div className="mb-3.5">
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
