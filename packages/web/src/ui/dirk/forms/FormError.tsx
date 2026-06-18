import type { ReactNode } from 'react';

interface FormErrorProps {
  /** Must match the `aria-describedby` the form's fields point at, so a
   *  screen reader ties the message to the inputs it describes. */
  id: string;
  children: ReactNode;
}

/**
 * The single error line every inline module composer (Mood / Goals /
 * Journal / Library) renders below its fields — a `role="alert"` live
 * region in muted danger text. Factored from five byte-identical copies
 * so the a11y contract (alert role + id wiring) can't drift between
 * forms. Renders nothing when there's no message, so callers drop the
 * `{error ? … : null}` wrapper.
 *
 * Not `InlineAlert`: that primitive is a bordered, padded box; these
 * footers are intentionally bare inline text under the form.
 */
export default function FormError({ id, children }: FormErrorProps) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-3 text-[12px] text-danger">
      {children}
    </p>
  );
}
