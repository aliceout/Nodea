/**
 * Discriminated union describing the async lifecycle of a page-level
 * data fetch. Used by every per-module Provider (`<GoalsProvider>`,
 * `<JournalProvider>`, `<LibraryProvider>`, `<MoodProvider>`) to
 * carry the *lifecycle status only* — the actual data lives in a
 * separate slice so the data context's array stays the single source
 * of truth.
 *
 * Centralised here (REFACTO-01) so any new module page (Habits,
 * Review v2…) can `import type { LoadState } from '@/core/types/load-state'`
 * instead of re-declaring the same four-variant union locally.
 */
export type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

/** Type guard helper. Useful for narrowing in JSX where `state.status === 'ready'`
 *  reads more verbose than `isReady(state)`. */
export function isReady(state: LoadState): state is { status: 'ready' } {
  return state.status === 'ready';
}

/** Returns the error message when the state is in error, otherwise `null`.
 *  Lets callers write `errorMessageOf(state) ?? defaultMessage`. */
export function errorMessageOf(state: LoadState): string | null {
  return state.status === 'error' ? state.message : null;
}
