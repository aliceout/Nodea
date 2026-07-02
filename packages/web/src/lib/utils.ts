import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `cn` — class-merging helper. `clsx` flattens conditional / array
 * inputs, `twMerge` resolves Tailwind conflicts so the last duplicate
 * class wins (`cn('px-2', 'px-4')` → `'px-4'`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Visible keyboard focus ring for custom clickable surfaces.
 *
 * The global reset in `ui/theme/utilities.css` strips the native outline on
 * every `<button>`/`<input>`, so any raw button that does NOT go through the
 * `Button` atom must re-add this ring itself, or keyboard focus becomes
 * invisible (WCAG 2.4.7). Single source so every call-site stays in sync —
 * used by the `Button` atom and the handful of bespoke buttons that can't.
 */
export const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
