import type { InputHTMLAttributes, Ref } from 'react';

import DirkInput from '@/ui/atoms/dirk/Input';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string;
  /** Forwarded to the underlying `<input>`. Useful when the caller
   *  needs to programmatically focus the field (e.g. on modal open). */
  ref?: Ref<HTMLInputElement>;
}

/** Labelled `<DirkInput>` used by the Danger tab's confirmation
 *  form. Auto-derives the `id` from the field name / label so the
 *  `<label htmlFor>` link stays correct without the caller having
 *  to think about it.
 *
 *  Pre-#35 this component rolled its own `<input>` with copy-pasted
 *  K · Sauge classes ; it had silently drifted (e.g. `rounded-md`
 *  vs. the canonical `rounded-sm`). Now delegates to `DirkInput`
 *  so any future style bump on the atom propagates here for free. */
export default function Field({
  label,
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
      <DirkInput id={inputId} name={name} {...(ref ? { ref } : {})} {...rest} />
    </div>
  );
}
