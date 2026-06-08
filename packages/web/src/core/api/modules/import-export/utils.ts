/**
 * Shared helpers for the Import/Export modules.
 *
 * `normalizeKeyPart` collapses arbitrary user input down to a stable
 * de-duplication key : NFKC normalisation (so visually identical
 * combining accents collapse), trim, internal spaces collapsed to
 * a single space, lowercased. Same input → same key, regardless of
 * how the user typed it.
 */
export function normalizeKeyPart(str: unknown): string {
  return String(str ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Collision-resistant fingerprint of an arbitrarily long free-text field,
 * for use as one part of a de-duplication key. A raw `content.slice(0, N)`
 * prefix is NOT safe: two distinct entries sharing their first N chars
 * (an identical template/preamble, a pasted quotation, a short note vs its
 * longer expansion) collapse to one key and the second is silently DROPPED
 * on import — the worst outcome for a backup. This folds the FULL string's
 * length + a djb2/xor hash, so genuinely different text always differs
 * while an identical re-import stays idempotent.
 *
 * Hashed over the raw string (not `normalizeKeyPart`-folded) to keep the
 * maximum distinguishing power; round-trips are byte-stable through JSON,
 * so the fingerprint is stable too.
 */
export function contentFingerprint(str: unknown): string {
  const s = String(str ?? '');
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return `${s.length}.${h.toString(36)}`;
}
