/**
 * Stable id of a FieldRow's inline error `<p>`, so a control can point
 * its `aria-describedby` at it. Mirrors the Field atom's
 * `${inputId}-error` scheme. Kept out of `FieldRow.tsx` so that file
 * only exports its component (react-refresh / fast-refresh constraint).
 */
export function fieldErrorId(htmlFor: string): string {
  return `${htmlFor}-error`;
}
