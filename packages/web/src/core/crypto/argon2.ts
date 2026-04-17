/**
 * Argon2id password-based key derivation, wrapping `hash-wasm`.
 *
 * Replaces the legacy `argon2-wasm` import; `hash-wasm` is maintained,
 * lighter, and ships its own typings. The parameters mirror what the old
 * `deriveKeyArgon2` produced (iterations=3, mem=64 MiB, parallelism=1,
 * output=32 bytes) so existing `encrypted_key` blobs keep decrypting.
 */
import { argon2id } from 'hash-wasm';
import { base64ToBytes } from './base64.ts';
import type { Base64 } from '@nodea/shared/crypto-types';

export interface DeriveArgon2Options {
  /** User password (UTF-8 string). */
  password: string;
  /** Salt as either raw bytes or a base64 string. */
  salt: Uint8Array | Base64 | string;
  /**
   * Output length in bytes. Defaults to 32 (AES-256 / HMAC-SHA-256 sub-key
   * size). Do not lower without auditing the whole crypto chain.
   */
  hashLength?: number;
}

const DEFAULT_ITERATIONS = 3;
const DEFAULT_MEM_KB = 64 * 1024;
const DEFAULT_PARALLELISM = 1;

function normaliseSalt(salt: Uint8Array | Base64 | string): Uint8Array {
  if (salt instanceof Uint8Array) return salt;
  // Accept base64 (legacy behaviour: the old code also tried base64 first).
  try {
    return base64ToBytes(salt);
  } catch {
    return new TextEncoder().encode(salt);
  }
}

/**
 * Derive 32 (or `hashLength`) bytes from a password via Argon2id.
 *
 * The returned buffer is the KEK — the symmetric key that wraps the
 * user's main key. Callers should pass it to
 * {@link import('./key-material.ts').deriveMainKeys} after unwrapping,
 * and zero it as soon as possible.
 */
export async function deriveKeyArgon2(opts: DeriveArgon2Options): Promise<Uint8Array> {
  const salt = normaliseSalt(opts.salt);
  const hashLength = opts.hashLength ?? 32;

  const hex = await argon2id({
    password: opts.password,
    salt,
    iterations: DEFAULT_ITERATIONS,
    memorySize: DEFAULT_MEM_KB,
    parallelism: DEFAULT_PARALLELISM,
    hashLength,
    outputType: 'hex',
  });

  const out = new Uint8Array(hashLength);
  for (let i = 0; i < hashLength; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
