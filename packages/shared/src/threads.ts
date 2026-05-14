/**
 * Split a comma-separated `thread` string into trimmed, deduped
 * tokens. The schema keeps `thread` as a single string so the
 * server stays oblivious ; splitting here is purely a UI
 * grouping convention. Empty or whitespace-only tokens drop
 * out, and dedup-then-stable order means `"#A, #A, #B"` becomes
 * `["#A", "#B"]` (not `["#A", "#A", "#B"]`).
 *
 * Used by Goals + Journal + Homepage. Lives here so the same
 * function backs every caller — when one of them needs a different
 * behaviour, that's a signal to fork *intentionally* rather than
 * to silently drift the copies.
 */
export function splitThreads(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of raw.split(',')) {
    const trimmed = token.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/** First comma-separated token of a `thread` string, trimmed.
 *  Empty string on a missing / blank thread. Convenience over
 *  `splitThreads(raw)[0] ?? ''` because the home block
 *  surfaces only the first thread per goal. */
export function firstThread(raw: string): string {
  return splitThreads(raw)[0] ?? '';
}
