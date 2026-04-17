/**
 * Single source of truth for byte ↔ base64 / base64url conversions and
 * cryptographically secure random bytes.
 *
 * Every other crypto module (aes, hmac, hkdf, guards) imports from here.
 * Do not reimplement these helpers elsewhere in the codebase — TypeScript's
 * branded types in `@nodea/shared/crypto-types` ensure a `Base64` cannot be
 * passed where a `Base64Url` is expected, and vice versa.
 */
import type { Base64, Base64Url } from '@nodea/shared/crypto-types';

/**
 * Encode raw bytes as standard base64 (alphabet: A-Z a-z 0-9 + /, `=` padded).
 */
export function bytesToBase64(bytes: Uint8Array): Base64 {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary) as Base64;
}

/**
 * Decode a standard base64 string into bytes. Throws on malformed input.
 */
export function base64ToBytes(b64: Base64 | string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/** base64 → base64url (url-safe, no `=` padding). */
export function base64ToBase64Url(b64: Base64 | string): Base64Url {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') as Base64Url;
}

/** base64url → base64. */
export function base64UrlToBase64(b64url: Base64Url | string): Base64 {
  const padLength = (4 - (b64url.length % 4)) % 4;
  return (b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength)) as Base64;
}

/** Encode raw bytes as base64url. */
export function bytesToBase64Url(bytes: Uint8Array): Base64Url {
  return base64ToBase64Url(bytesToBase64(bytes));
}

/** Decode a base64url string into bytes. */
export function base64UrlToBytes(b64url: Base64Url | string): Uint8Array {
  return base64ToBytes(base64UrlToBase64(b64url));
}

/**
 * Cryptographically secure random bytes via the WebCrypto API. The only
 * entry point for randomness in the codebase — never reimplement.
 */
export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 0 || length > 65_536) {
    throw new RangeError(`randomBytes: invalid length ${length}`);
  }
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}
