/**
 * Plain cryptographic hashes (raw bytes in → raw bytes out).
 *
 * The single home for a bare `SHA-256` digest, so callers OUTSIDE `core/crypto`
 * never touch `crypto.subtle` directly (lint-enforced — every crypto primitive
 * stays auditable in one place). `bip39.ts` keeps its own hex convenience
 * (`sha256Hex`, for the recovery-code hash); this is the byte-oriented sibling,
 * used where the digest feeds more bytes — e.g. PKCE's S256 challenge.
 */

/** SHA-256 of `bytes`, as raw 32 bytes. */
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return new Uint8Array(digest);
}
