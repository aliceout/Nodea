/**
 * Pure helpers for thread mutation operations (issue #57 — thread
 * manager). The journal's `thread` field is a single
 * comma-separated string ; @nodea/shared's `splitThreads` parses
 * it for grouping / filtering. These helpers do the reverse :
 * given the raw thread string, they produce a NEW raw string
 * after applying a rename, merge, or delete operation.
 *
 * All helpers preserve token order (within the limits of the dedup
 * inherent to `splitThreads`) and re-emit a clean
 * `<token>, <token>` join. They never mutate the input.
 *
 * Kept dep-free + pure so the action callbacks in
 * `context.tsx` can compose them inside a transaction without
 * worrying about side effects.
 */
import { splitThreads } from '@nodea/shared';

/** Re-emit a token list as the canonical raw `thread` string. */
function join(tokens: readonly string[]): string {
  return tokens.join(', ');
}

/**
 * Replace every occurrence of `from` (case-sensitive, exact match)
 * inside the thread string with `to`. Dedup is automatic because
 * `splitThreads` removes duplicates after the rewrite.
 *
 * Returns the unchanged input when `from` doesn't appear (so the
 * caller can skip the PATCH).
 */
export function renameThreadInString(
  raw: string,
  from: string,
  to: string,
): string {
  const tokens = splitThreads(raw);
  if (!tokens.includes(from)) return raw;
  // Run the result back through splitThreads to dedup in case
  // `to` was already in the list (rename to a name that already
  // existed = de facto merge).
  const rewritten = tokens.map((t) => (t === from ? to : t));
  return join(splitThreads(rewritten.join(', ')));
}

/**
 * Merge every thread in `sources` into a single target name.
 * Equivalent to running `renameThreadInString` once per source
 * but in a single pass + a single dedup. `target` is allowed to
 * be one of the sources (merge-into-self collapses duplicates).
 *
 * Returns the unchanged input when none of the sources appear.
 */
export function mergeThreadsInString(
  raw: string,
  sources: readonly string[],
  target: string,
): string {
  const tokens = splitThreads(raw);
  const sourceSet = new Set(sources);
  if (!tokens.some((t) => sourceSet.has(t))) return raw;
  const rewritten = tokens.map((t) => (sourceSet.has(t) ? target : t));
  return join(splitThreads(rewritten.join(', ')));
}

/**
 * Drop every occurrence of `target` from the thread string. The
 * entry can end up with an empty thread — that's a valid state
 * (sans-thread bucket on the list page).
 *
 * Returns the unchanged input when `target` doesn't appear.
 */
export function removeThreadFromString(raw: string, target: string): string {
  const tokens = splitThreads(raw);
  if (!tokens.includes(target)) return raw;
  return join(tokens.filter((t) => t !== target));
}
