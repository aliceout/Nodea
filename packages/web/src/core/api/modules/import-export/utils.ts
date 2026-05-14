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
