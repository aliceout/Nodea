/**
 * Split a comma-separated `thread` string into trimmed, deduped
 * tokens. The schema keeps `thread` as a single string so the
 * server stays oblivious ; splitting here is purely a UI grouping
 * convention. Empty or whitespace-only tokens drop out, and
 * dedup-then-stable order means `"#A, #A, #B"` becomes
 * `["#A", "#B"]` (not `["#A", "#A", "#B"]`).
 *
 * Also used by the Journal module — keep this implementation
 * identical so the shared util can be promoted to
 * `packages/shared` once the Journal refacto lands.
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
