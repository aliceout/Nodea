import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string;
  error?: string | undefined;
  /** Optional helper rendered below the input when there's no
   *  error — e.g. live password-strength readout on Reset. The
   *  error path takes priority: when both are set, only the error
   *  shows. */
  legend?: ReactNode;
}

/**
 * Auth-form input field — Direction K · Sauge.
 *
 * Pairs a 12-px muted label with the K house input style: 1-px
 * hairline border that flips to accent on focus, with a 3-px
 * accent-soft glow ring. Surfaces the validation error inline
 * below the input wired through `aria-invalid` + `aria-describedby`
 * so assistive tech announces the failure rather than the user
 * having to hunt for it.
 *
 * Used by every auth page (Login, Register, Reset, Recover,
 * RequestReset, RecoveryCode, Passkeys, ChangePassword, Totp,
 * LoginMfa) — they used to each ship their own private copy of
 * exactly this component.
 *
 * `id` is auto-derived from the `name` prop (or the label as
 * fallback) so a caller that doesn't care about specific anchor
 * targets gets sensible aria wiring for free.
 */
const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, legend, className, id, name, ...rest },
  ref,
) {
  const inputId =
    id ?? `field-${name ?? label.replace(/\W/g, '-').toLowerCase()}`;
  const legendId = legend && !error ? `${inputId}-legend` : undefined;
  return (
    <div className="mb-3.5">
      <label
        htmlFor={inputId}
        className="mb-1.25 block text-[12px] font-medium text-muted"
      >
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${inputId}-error` : legendId
        }
        className={cn(
          'w-full rounded-md border border-hair bg-bg px-3 py-2.5 text-[14px] text-ink',
          'outline-none transition-[border-color,box-shadow]',
          'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'read-only:cursor-default read-only:bg-bg-2',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="mt-1 text-[11px] text-danger"
        >
          {error}
        </p>
      ) : legend ? (
        <p id={legendId} className="mt-1 text-[11px] text-muted">
          {legend}
        </p>
      ) : null}
    </div>
  );
});

export default Field;
