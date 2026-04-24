/**
 * HKDF (RFC 5869) domain-separated key derivation.
 *
 * Nodea's main key is 32 bytes of high-entropy material. The old code
 * imported those same 32 bytes as BOTH an AES-GCM key AND an HMAC key,
 * which re-uses the secret across two primitives — a cryptographic
 * anti-pattern. HKDF with distinct `info` labels splits the main key into
 * two independent sub-keys; a compromise of one cannot be used to forge
 * the other.
 */

const textEncoder = new TextEncoder();

/** Label for the AES-GCM sub-key used to wrap payloads. */
export const HKDF_LABEL_AES = 'nodea:aes' as const;
/** Label for the HMAC-SHA-256 sub-key used for guard computation. */
export const HKDF_LABEL_HMAC = 'nodea:hmac' as const;

/**
 * Derive `length` bytes from `ikm` using HKDF-SHA-256 with the given label.
 *
 * Salt is deliberately empty (zero-length). Per RFC 5869, an empty salt
 * is equivalent to a salt of hash-length zeros. The main key itself is
 * high-entropy, so HKDF's extract step only needs to spread that entropy
 * across the output — no additional randomness from a salt is required.
 *
 * @param ikm   raw input key material (32 bytes for the main key)
 * @param label domain-separation label; use the exported constants
 * @param lengthBytes number of output bytes (32 for AES-256, 32 for HMAC-SHA-256)
 */
export async function hkdfDeriveBits(
  ikm: Uint8Array,
  label: string,
  lengthBytes: number,
): Promise<Uint8Array> {
  const ikmKey = await crypto.subtle.importKey(
    'raw',
    ikm as BufferSource,
    'HKDF',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0) as BufferSource,
      info: textEncoder.encode(label) as BufferSource,
    },
    ikmKey,
    lengthBytes * 8,
  );
  return new Uint8Array(derived);
}
