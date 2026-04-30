/**
 * BIP39 12-word recovery code helpers (Auth-Roadmap Phase 3,
 * Auth-Spec §7.7).
 *
 * The recovery code is the **only** non-destructive way to regain
 * access when the password is lost: 16 bytes of entropy, encoded
 * as 12 BIP39 mnemonic words for transcription, that the client
 * uses to derive an HKDF sub-key that wraps the user's KEK.
 *
 *   16 bytes entropy ──┬──▶ 12 words (display + transcription)
 *                      └──▶ HKDF "nodea:wrap-kek" ──▶ AES key ──▶ wrap KEK
 *
 * Server only ever sees `SHA-256(entropy)` as `users.recovery_code_hash`
 * — that's enough to gate the recover flow without giving the
 * server any way to derive the wrap key (128 bits of entropy + a
 * one-way hash = uncrackable offline). The 4 extra checksum bits
 * inside BIP39's 12-word format catch transcription typos before
 * the server ever sees the request.
 *
 * Library: `@scure/bip39` (paulmillr's audited zero-dep impl,
 * works in browser + Node). The English wordlist is the V1
 * canonical wordlist per Auth-Spec §13 — switching to a different
 * wordlist is a hard fork, every existing recovery row would
 * stop validating.
 */
import {
  entropyToMnemonic,
  generateMnemonic,
  mnemonicToEntropy,
  validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

/** Number of bytes of true entropy in a 12-word BIP39 mnemonic. */
export const BIP39_ENTROPY_BYTES = 16;
/** Number of words in a Nodea recovery code. */
export const RECOVERY_CODE_WORDS = 12;

/**
 * Generate a fresh 12-word recovery code. Returns both the
 * mnemonic (for display + transcription) and the raw entropy
 * bytes (for HKDF + SHA-256 hashing). Caller is responsible for
 * zeroing the entropy bytes after use.
 */
export function generateRecoveryMnemonic(): {
  mnemonic: string;
  entropy: Uint8Array;
} {
  // 128 bits = 12 words.
  const mnemonic = generateMnemonic(wordlist, 128);
  const entropy = new Uint8Array(mnemonicToEntropy(mnemonic, wordlist));
  return { mnemonic, entropy };
}

/**
 * Parse a user-typed mnemonic back into entropy bytes. Returns
 * `null` on any failure (wrong word count, unknown word, bad
 * checksum). Doesn't throw — UI surfaces a generic "code invalide"
 * regardless of the failure mode (no oracle for which words are
 * legit BIP39).
 *
 * The returned `Uint8Array` is sensitive: zero it after use via
 * `entropy.fill(0)`.
 */
export function recoveryMnemonicToEntropy(
  mnemonic: string,
): Uint8Array | null {
  const cleaned = normaliseMnemonic(mnemonic);
  if (cleaned.split(' ').length !== RECOVERY_CODE_WORDS) return null;
  if (!validateMnemonic(cleaned, wordlist)) return null;
  try {
    return new Uint8Array(mnemonicToEntropy(cleaned, wordlist));
  } catch {
    // `mnemonicToEntropy` throws on checksum mismatch. We've
    // already validated the mnemonic above, but keep this as a
    // belt-and-braces guard — a corrupted wordlist or a future
    // lib version could surface a fresh failure mode here.
    // null = "invalid mnemonic", same surface as the validation
    // checks above.
    return null;
  }
}

/**
 * Normalise user input: collapse whitespace, lowercase. The
 * BIP39 wordlist is lowercase ASCII so case differences are pure
 * noise (typos pasted from a screenshot, etc.).
 */
export function normaliseMnemonic(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Format mnemonic words for the 4×3 display grid.
 */
export function splitMnemonicForDisplay(mnemonic: string): string[][] {
  const words = mnemonic.split(' ');
  const rows: string[][] = [];
  for (let i = 0; i < words.length; i += 3) {
    rows.push(words.slice(i, i + 3));
  }
  return rows;
}

/**
 * SHA-256 of `bytes`, returned as 64 lowercase hex chars. Used to
 * compute `users.recovery_code_hash` from the BIP39 entropy — same
 * shape the server compares against in constant time.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < view.length; i += 1) {
    hex += view[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Re-export so callers don't need to know the lib choice. Useful
 * for round-trip tests that need the exact wordlist.
 */
export { entropyToMnemonic, validateMnemonic, wordlist };
