/**
 * Main key material management.
 *
 * Replaces the legacy `createMainKeyMaterialFromBase64` which mistakenly
 * imported the same 32 raw bytes as both an AES-GCM key and an HMAC key.
 * The new flow:
 *
 *   rawMainKeyBytes (32 B)
 *          │ HKDF-SHA-256
 *          ├──── info="nodea:aes"  ──►  32 B ──► AES-GCM CryptoKey (non-extractable)
 *          └──── info="nodea:hmac" ──►  32 B ──► HMAC-SHA-256 CryptoKey (non-extractable)
 *
 * The two sub-keys are independent: breaking one does not yield the other.
 */
import type { AesMainKey, HmacMainKey } from '@nodea/shared/crypto-types';
import { HKDF_LABEL_AES, HKDF_LABEL_HMAC, hkdfDeriveBits } from './hkdf.ts';

export interface MainKeyMaterial {
  aesKey: AesMainKey;
  hmacKey: HmacMainKey;
}

const AES_KEY_BYTES = 32;
const HMAC_KEY_BYTES = 32;

/**
 * Derive the two sub-keys from raw main-key bytes via HKDF-SHA-256.
 *
 * The returned `CryptoKey`s are non-extractable. The caller is expected
 * to zero the input `rawBytes` buffer when it no longer needs it
 * (see {@link wipeRawBytes}). The sub-keys live inside the browser's
 * opaque key store.
 */
export async function deriveMainKeys(rawBytes: Uint8Array): Promise<MainKeyMaterial> {
  if (rawBytes.length !== 32) {
    throw new Error(`main key must be 32 bytes, got ${rawBytes.length}`);
  }

  const [aesBytes, hmacBytes] = await Promise.all([
    hkdfDeriveBits(rawBytes, HKDF_LABEL_AES, AES_KEY_BYTES),
    hkdfDeriveBits(rawBytes, HKDF_LABEL_HMAC, HMAC_KEY_BYTES),
  ]);

  try {
    const [aesKey, hmacKey] = await Promise.all([
      crypto.subtle.importKey(
        'raw',
        aesBytes as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
      ),
      crypto.subtle.importKey(
        'raw',
        hmacBytes as BufferSource,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
      ),
    ]);
    return { aesKey: aesKey as AesMainKey, hmacKey: hmacKey as HmacMainKey };
  } finally {
    // The derived bytes now live inside the non-extractable CryptoKey
    // objects; zero our local copies.
    aesBytes.fill(0);
    hmacBytes.fill(0);
  }
}

/**
 * Zero a buffer of raw key material in place.
 *
 * Important: this is the ONLY honest wipe we can perform. WebCrypto
 * `CryptoKey` objects are opaque handles — there is no API to zero their
 * internal state. For a full guarantee, trigger a full page reload which
 * destroys the entire browser process state (including the opaque key
 * store). The legacy `wipeMainKeyMaterial` was a placebo that pretended
 * to wipe CryptoKeys via no-op `digest("")` calls; it has been removed.
 */
export function wipeRawBytes(bytes: Uint8Array | null | undefined): void {
  if (bytes && bytes.byteLength > 0) {
    bytes.fill(0);
  }
}

