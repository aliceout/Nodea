import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

/**
 * K · Sauge checkbox — the canonical box for any `<input type="checkbox">`.
 *
 * WHAT  Centralises the checkbox's size, accent colour and (new) a visible
 *       `focus-visible` ring. Render it inside the caller's own `<label>` so each
 *       site keeps its own layout — `items-start` confirm rows pass
 *       `className="mt-0.5"`, `items-center` filter rows pass nothing.
 * WHERE `ui/atoms/dirk/`, beside `Input`/`Select`. Same rationale as `Input`:
 *       the three confirm/filter checkboxes (Totp `BackupCodesPanel`, `ResetForm`,
 *       HRT `ExportFilterColumn`) were hand-rolling the same box classes — the
 *       third copy is the cue to factor (CLAUDE.md UI rule), and none of the
 *       three carried a keyboard focus ring, which this fixes for all of them.
 * NOTE  Forwards every native input attribute; caller `className` merges LAST so
 *       a one-off layout tweak still wins.
 */
export default function Checkbox({ className, ref, ...props }: CheckboxProps) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-hair accent-accent',
        'focus-visible:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
