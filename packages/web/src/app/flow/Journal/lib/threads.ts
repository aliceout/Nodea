/**
 * Comma-separated thread tokens — same convention as Goals so an
 * entry tagged `#A, #B` lands in both fils. Empty / whitespace
 * tokens drop, dedupe preserves first-seen order.
 *
 * Identical to `flow/Goals/lib/threads.ts` ; promotion to
 * `packages/shared` is in the post-roadmap follow-ups.
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
