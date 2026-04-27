/**
 * Passkey PRF helpers (Auth-Roadmap Phase 4, Auth-Spec §9.4-§9.5).
 *
 * The WebAuthn `prf` extension exposes a per-credential pseudo-random
 * function whose output is deterministic for a given (credential, input)
 * pair. We feed it a fixed 32-byte input — `PRF_INPUT_V1` — so a
 * single passkey always produces the same output across logins, even
 * though the assertion challenge changes each time.
 *
 * That `prf_output` is then run through HKDF (label `nodea:wrap-kek`)
 * to derive an AES-GCM key, which wraps the user's KEK. AAD binds the
 * ciphertext to `(userId, "passkey", credentialId)` so a row swap
 * between two of the same user's passkeys fails the auth-tag check at
 * decrypt time.
 *
 * The wrap helpers are thin wrappers around `factor-wrap.ts` —
 * `wrapKekUnderFactor` already does the HKDF + AES-GCM dance and
 * doesn't care whether the IKM came from OPAQUE, BIP39, or PRF.
 *
 * # PRF input versioning
 *
 * `PRF_INPUT_V1` is the literal string `"nodea:prf-v1"` (12 bytes)
 * followed by 20 zero bytes — total 32 bytes, the size WebAuthn's
 * PRF input field expects on the wire.
 *
 * Versioned because rotating the input is the only way to refresh
 * `prf_output` for a given credential without re-enrolling. A future
 * `v2` would force a re-wrap of every existing `auth_factors.wrapped_kek`
 * (since the KEK moves under a freshly-derived AES key); the current
 * column would have to be migrated in lockstep with the new constant.
 */
import { hkdfDeriveBits } from './hkdf.ts';
import {
  base64ToBytes,
  base64UrlToBytes,
  bytesToBase64,
  bytesToBase64Url,
  randomBytes,
} from './base64.ts';
import { buildPasskeyAAD } from './factor-wrap.ts';
import type { Base64 } from '@nodea/shared/crypto-types';

/* ============================================================================
 * PRF input — fixed 32-byte buffer
 * ========================================================================== */

/**
 * Fixed PRF input for Nodea v1. Decoded form: ASCII `"nodea:prf-v1"`
 * (12 bytes) + 20 zero bytes. We hand-roll the buffer so the constant
 * is auditable byte-by-byte at review time without trusting a
 * `TextEncoder` round-trip.
 */
export const PRF_INPUT_V1: Uint8Array = (() => {
  const out = new Uint8Array(32);
  // "nodea:prf-v1" — 12 bytes of ASCII.
  const ascii = [0x6e, 0x6f, 0x64, 0x65, 0x61, 0x3a, 0x70, 0x72, 0x66, 0x2d, 0x76, 0x31];
  for (let i = 0; i < ascii.length; i++) out[i] = ascii[i]!;
  // The remaining 20 bytes stay 0 (Uint8Array default).
  return out;
})();

/* ============================================================================
 * Credential id encoding helpers
 * ========================================================================== */

/**
 * Canonical base64url-encode a raw credential id (`Uint8Array` from
 * the WebAuthn API) for use as both the DB primary lookup and the
 * AAD component. No padding, URL-safe alphabet.
 */
export function credentialIdToB64Url(rawId: Uint8Array): string {
  return bytesToBase64Url(rawId);
}

/* ============================================================================
 * Wrap / unwrap KEK under PRF output
 * ========================================================================== */

export interface PasskeyKekWrap {
  wrappedKek: Base64;
  wrappedKekIv: Base64;
}

const HKDF_LABEL_WRAP_KEK = 'nodea:wrap-kek' as const;

const textEncoder = new TextEncoder();

async function deriveAesKey(
  prfOutput: Uint8Array,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const subkey = await hkdfDeriveBits(prfOutput, HKDF_LABEL_WRAP_KEK, 32);
  try {
    return await crypto.subtle.importKey(
      'raw',
      subkey as BufferSource,
      { name: 'AES-GCM' },
      false,
      usage,
    );
  } finally {
    subkey.fill(0);
  }
}

/**
 * Wrap the 32-byte KEK under a key derived from `prfOutput` via HKDF
 * label `nodea:wrap-kek`. AAD binds the ciphertext to
 * `(userId, "passkey", credentialIdB64Url)`.
 */
export async function wrapKekUnderPrf(
  kekBytes: Uint8Array,
  prfOutput: Uint8Array,
  userId: string,
  credentialIdB64Url: string,
): Promise<PasskeyKekWrap> {
  const aesKey = await deriveAesKey(prfOutput, ['encrypt']);
  const iv = randomBytes(12);
  const aad = buildPasskeyAAD(userId, credentialIdB64Url);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: textEncoder.encode(aad) as BufferSource,
    },
    aesKey,
    kekBytes as BufferSource,
  );
  return {
    wrappedKek: bytesToBase64(new Uint8Array(ciphertext)),
    wrappedKekIv: bytesToBase64(iv),
  };
}

/**
 * Unwrap the KEK previously sealed by {@link wrapKekUnderPrf}. Throws
 * on AAD mismatch or auth-tag failure — both signal the caller used
 * the wrong PRF output / wrong credential / wrong user binding.
 */
export async function unwrapKekUnderPrf(
  wrap: PasskeyKekWrap,
  prfOutput: Uint8Array,
  userId: string,
  credentialIdB64Url: string,
): Promise<Uint8Array> {
  const aesKey = await deriveAesKey(prfOutput, ['decrypt']);
  const iv = base64ToBytes(wrap.wrappedKekIv);
  const data = base64ToBytes(wrap.wrappedKek);
  const aad = buildPasskeyAAD(userId, credentialIdB64Url);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: textEncoder.encode(aad) as BufferSource,
    },
    aesKey,
    data as BufferSource,
  );
  return new Uint8Array(plaintext);
}

/* ============================================================================
 * Helpers exposed for tests + the enrollment / login orchestrators
 * ========================================================================== */

/**
 * Decode a base64url string back to bytes — small re-export so call
 * sites can stay on this module without reaching into `base64.ts`
 * directly. (The wider crypto module already exports `base64UrlToBytes`,
 * but pulling it through here keeps the passkey surface coherent.)
 */
export function decodeBase64Url(value: string): Uint8Array {
  return base64UrlToBytes(value);
}
