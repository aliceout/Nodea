/**
 * Pure helpers for the « prove you wrote the mnemonic down » quiz
 * (Cake-Wallet style) used by RecoveryCodeDisplay.
 *
 * Where it sits: web auth UI. The recovery-code (and, later, backup)
 * confirmation step hides the words and asks the user to re-type a few
 * of them at random positions — impossible to pass from memory, so it
 * forces an actual transcription instead of a blind « I saved it »
 * checkbox.
 *
 * Kept separate from the React component so the position-picking and
 * answer-matching logic stays unit-testable without rendering.
 */

/**
 * Pick `count` DISTINCT positions in `[0, total)`, sorted ascending.
 * Uses the crypto RNG so the quizzed slots aren't predictable (not a
 * secret — just no fixed pattern to rote-learn). Caps at `total` when
 * asked for more than exist.
 */
export function pickQuizPositions(total: number, count: number): number[] {
  const n = Math.min(count, Math.max(0, total));
  const chosen = new Set<number>();
  const buf = new Uint32Array(1);
  while (chosen.size < n) {
    crypto.getRandomValues(buf);
    chosen.add(buf[0]! % total);
  }
  return [...chosen].sort((a, b) => a - b);
}

/** Normalise one word for comparison. BIP39 words are lowercase ASCII,
 *  so trim + lowercase makes the check forgiving of casing/whitespace
 *  without ever accepting a different word. */
export function normaliseWord(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * True only when every quizzed position was answered with the right
 * word. Length-mismatched inputs fail closed.
 */
export function checkQuizAnswers(
  words: readonly string[],
  positions: readonly number[],
  answers: readonly string[],
): boolean {
  if (positions.length === 0 || positions.length !== answers.length) return false;
  return positions.every(
    (pos, i) => normaliseWord(answers[i] ?? '') === normaliseWord(words[pos] ?? ''),
  );
}
