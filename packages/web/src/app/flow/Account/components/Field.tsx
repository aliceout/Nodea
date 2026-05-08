import type { InputHTMLAttributes, Ref } from 'react';

import { cn } from '@/lib/utils';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string;
  /** Forwarded to the underlying `<input>`. Useful when the caller
   *  needs to programmatically focus the field (e.g. on modal open). */
  ref?: Ref<HTMLInputElement>;
}

/** Labelled `<input>` used by the Danger tab's confirmation form.
 *  Auto-derives the `id` from the field name / label so the
 *  `<label htmlFor>` link stays correct without the caller having
 *  to think about it. */
export default function Field({
  label,
  className,
  id,
  name,
  ref,
  ...rest
}: FieldProps) {
  const inputId = id ?? `acct-${name ?? label.replace(/\W/g, '-').toLowerCase()}`;
  return (
    <div className="mb-4">
      <label
        htmlFor={inputId}
        className="mb-[5px] block text-[12px] font-medium text-muted"
      >
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        ref={ref}
        className={cn(
          'block h-8 w-full rounded-md border border-hair bg-bg px-3 text-[13px] text-ink',
          'outline-none transition-[border-color,box-shadow]',
          'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...rest}
      />
    </div>
  );
}
