/**
 * HRT — labelled text input matching the module forms' control height.
 *
 * `FieldRow` (label + error) wrapped around the dirk `Input` atom
 * (`h-8`), so every text/number/date field lines up pixel-for-pixel
 * with the `Select` controls in the same form. The shared `Field`
 * atom is intentionally NOT used here : it's the taller auth-page
 * field (`py-2.5`), which sat 8 px higher than the selects.
 *
 * Forwards every native input attribute (`type`, `list`, `step`,
 * `placeholder`, the RHF `register()` spread…) straight through.
 */
import type { InputHTMLAttributes, Ref } from 'react';

import Input from '@/ui/atoms/dirk/Input';

import FieldRow from './FieldRow';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

export default function TextField({ label, error, id, ref, ...rest }: TextFieldProps) {
  const inputId = id ?? `hrt-${rest.name ?? label.replace(/\W/g, '-').toLowerCase()}`;
  return (
    <FieldRow label={label} htmlFor={inputId} error={error}>
      <Input
        id={inputId}
        {...(error ? { 'aria-invalid': true as const } : {})}
        {...(ref ? { ref } : {})}
        {...rest}
      />
    </FieldRow>
  );
}
