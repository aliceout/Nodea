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
