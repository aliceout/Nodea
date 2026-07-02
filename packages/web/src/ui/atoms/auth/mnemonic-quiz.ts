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

import { randomBytes } from '@/core/crypto/base64';

/**
 * Pick `count` DISTINCT positions in `[0, total)`, sorted ascending.
 * Draws from the shared CSPRNG so the quizzed slots aren't predictable
 * (not a secret — just no fixed pattern to rote-learn). Caps at `total`
 * when asked for more than exist.
 */
export function pickQuizPositions(total: number, count: number): number[] {
  const n = Math.min(count, Math.max(0, total));
  if (n === 0) return [];
  const chosen = new Set<number>();
  // Uniform index in [0, total) from the single randomBytes source
  // (crypto rule 3). Rejection-sampling the final partial 2^32 block
  // drops the modulo bias a bare `u32 % total` would carry.
  const limit = 0x1_0000_0000 - (0x1_0000_0000 % total);
  while (chosen.size < n) {
    const bytes = randomBytes(4);
    const r = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0);
    if (r >= limit) continue;
    chosen.add(r % total);
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
