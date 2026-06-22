import type { ReactNode } from 'react';

interface FormErrorProps {
  /** Anchor id for the message. In the module composers (Mood / Goals /
   *  Journal / Library) a field points its `aria-describedby` here so a
   *  screen reader ties the error to the inputs it describes. The HRT
   *  forms surface a *form-level* submit error with no single owning
   *  field, so they leave the id unreferenced and rely on `role="alert"`
   *  to announce it — both are valid, the role drives the announcement. */
  id: string;
  children: ReactNode;
}

/**
 * The single error line every inline composer renders below its fields —
 * a `role="alert"` live region in muted danger text. Adopted by the four
 * module composers (Mood / Goals / Journal / Library, field-linked via
 * `id`) and the four HRT forms (form-level, alert-only) so the a11y
 * contract (alert role + consistent styling) can't drift between forms.
 * Renders nothing when there's no message, so callers drop the
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
