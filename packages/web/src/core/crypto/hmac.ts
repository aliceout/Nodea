/**
 * HMAC-SHA-256 signing / verification using an `HmacMainKey` sub-key.
 *
 * The branded type makes it a compile error to pass an AES sub-key to a
 * signing function — the two `CryptoKey` instances are identical at
 * runtime shape but distinct at compile time.
 */
import type { HmacMainKey } from '@nodea/shared/crypto-types';

const textEncoder = new TextEncoder();

/** Sign a string or byte buffer with HMAC-SHA-256, returning the raw tag. */
export async function hmacSha256(
  key: HmacMainKey,
  message: string | Uint8Array,
): Promise<Uint8Array> {
  const data = typeof message === 'string' ? textEncoder.encode(message) : message;
  const signature = await crypto.subtle.sign('HMAC', key, data as BufferSource);
  return new Uint8Array(signature);
}

/**
 * Verify a tag against a message + key in constant time via WebCrypto.
 * Returns true iff the tag is valid.
 */
export async function hmacVerify(
  key: HmacMainKey,
  message: string | Uint8Array,
  tag: Uint8Array,
): Promise<boolean> {
  const data = typeof message === 'string' ? textEncoder.encode(message) : message;
  return crypto.subtle.verify('HMAC', key, tag as BufferSource, data as BufferSource);
}
