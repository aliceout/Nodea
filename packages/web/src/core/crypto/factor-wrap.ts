/**
 * KEK / main-key wrapping helpers used by the OPAQUE flow
 * (Auth-Roadmap Phase 2, Auth-Spec §3.2 + §13).
 *
 * Two layers of AES-GCM wrapping back the new key model:
 *
 *     mainKey  ── wrapped under KEK ──▶  wrapped_main_key
 *     KEK      ── wrapped under AES key derived from a "factor" ──▶
 *                                       wrapped_kek_password / _passkey / _recovery
 *
 * A "factor" is whatever 32-byte secret a particular login path
 * produces:
 *
 *   - OPAQUE  → `export_key` (this file is the only V1 caller)
 *   - WebAuthn PRF (Phase 4) → `prf_output`
 *   - Recovery code (Phase 3) → BIP39 entropy
 *
 * All three feed the same wrapping construction; only the IKM
 * changes. Domain separation between layers happens at the HKDF
 * label level (`nodea:wrap-kek` vs `nodea:wrap-main`); domain
 * separation between factors happens at the IKM level (different
 * factors produce different secrets, fed under the same label).
 *
 * AAD binds each ciphertext to the user it belongs to (Auth-Spec
 * §4 schema comments). Without AAD a server-side row swap could
 * silently feed user A's wrapped KEK to user B's session — AES-GCM
 * `additionalData` makes that mismatch produce an auth-tag failure
 * at decrypt time.
 *
 * The lib-supplied `exportKey` from `@serenity-kit/opaque` is a
 * **base64url** string (its native wire encoding for everything from
 * envelope blobs to the static setup). For other factors the IKM
 * arrives as raw `Uint8Array` (PRF outputs, BIP39 entropy). We
 * accept both forms in {@link asIkmBytes} to keep call sites
 * symmetric.
 */
import type { Base64 } from '@nodea/shared/crypto-types';
import { hkdfDeriveBits } from './hkdf.ts';
import {
  base64ToBytes,
  base64UrlToBytes,
  bytesToBase64,
  randomBytes,
} from './base64.ts';

const textEncoder = new TextEncoder();

/** HKDF label for the AES key that wraps the KEK under a factor. */
export const HKDF_LABEL_WRAP_KEK = 'nodea:wrap-kek' as const;
/** HKDF label for the AES key that wraps the main key under the KEK. */
export const HKDF_LABEL_WRAP_MAIN = 'nodea:wrap-main' as const;

/* ============================================================================
 * IKM normalisation
 * ========================================================================== */

/**
 * Normalise a base64url-encoded string OR a raw `Uint8Array` IKM
 * to bytes. The `@serenity-kit/opaque` lib gives `exportKey` as
 * base64url; passkey PRF outputs and BIP39 entropy come in as
 * `Uint8Array` directly.
 */
function asIkmBytes(ikm: string | Uint8Array): Uint8Array {
  return typeof ikm === 'string' ? base64UrlToBytes(ikm) : ikm;
}

/* ============================================================================
 * Sub-key derivation
 * ========================================================================== */

async function importAesKey(
  bytes: Uint8Array,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    bytes as BufferSource,
    { name: 'AES-GCM' },
    false,
    usage,
  );
}

async function deriveAesKeyFrom(
  ikm: Uint8Array,
  label: string,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const subkey = await hkdfDeriveBits(ikm, label, 32);
  try {
    return await importAesKey(subkey, usage);
  } finally {
    // The CryptoKey holds the derived bits internally; we can scrub
    // the JS-visible copy. The CryptoKey itself is non-extractable.
    subkey.fill(0);
  }
}

/* ============================================================================
 * Wrap / unwrap KEK under a factor (OPAQUE export_key, PRF, recovery code)
 * ========================================================================== */

export interface KekWrap {
  /** Base64 AES-GCM ciphertext of the 32-byte KEK. */
  wrappedKek: Base64;
  /** Base64 12-byte IV. */
  wrappedKekIv: Base64;
}

/**
 * Wrap a 32-byte KEK under a key derived from `factorIkm` via HKDF
 * label {@link HKDF_LABEL_WRAP_KEK}. AAD binds the ciphertext to the
 * user — Auth-Spec §4 schema docs prescribe `users.id` + a per-factor
 * tag (e.g. `"password"` for OPAQUE), so callers pass the full AAD
 * string here.
 */
export async function wrapKekUnderFactor(
  kekBytes: Uint8Array,
  factorIkm: string | Uint8Array,
  aad: string,
): Promise<KekWrap> {
  const wrapKey = await deriveAesKeyFrom(
    asIkmBytes(factorIkm),
    HKDF_LABEL_WRAP_KEK,
    ['encrypt'],
  );
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: textEncoder.encode(aad) as BufferSource,
    },
    wrapKey,
    kekBytes as BufferSource,
  );
  return {
    wrappedKek: bytesToBase64(new Uint8Array(ciphertext)),
    wrappedKekIv: bytesToBase64(iv),
  };
}

/**
 * Unwrap the KEK previously sealed by {@link wrapKekUnderFactor}.
 * Throws on AAD or auth-tag mismatch — both are reliable signals the
 * caller used the wrong factor / wrong user binding.
 */
export async function unwrapKekUnderFactor(
  wrap: KekWrap,
  factorIkm: string | Uint8Array,
  aad: string,
): Promise<Uint8Array> {
  const wrapKey = await deriveAesKeyFrom(
    asIkmBytes(factorIkm),
    HKDF_LABEL_WRAP_KEK,
    ['decrypt'],
  );
  const iv = base64ToBytes(wrap.wrappedKekIv);
  const data = base64ToBytes(wrap.wrappedKek);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: textEncoder.encode(aad) as BufferSource,
    },
    wrapKey,
    data as BufferSource,
  );
  return new Uint8Array(plaintext);
}

/* ============================================================================
 * Wrap / unwrap main key under KEK
 * ========================================================================== */

export interface MainKeyWrap {
  /** Base64 AES-GCM ciphertext of the 32-byte main key. */
  wrappedMainKey: Base64;
  /** Base64 12-byte IV. */
  wrappedMainKeyIv: Base64;
}

/**
 * Wrap the 32-byte main key under a key derived from the KEK via
 * HKDF label {@link HKDF_LABEL_WRAP_MAIN}. AAD = `users.id`.
 *
 * Per Auth-Spec §3.2, this wrap happens ONCE at register and is
 * never re-wrapped — change-password rotates the KEK envelope, not
 * this one. That guarantees every existing ciphertext keeps
 * decrypting after a password change.
 */
export async function wrapMainKeyUnderKek(
  mainKeyBytes: Uint8Array,
  kekBytes: Uint8Array,
  aad: string,
): Promise<MainKeyWrap> {
  const wrapKey = await deriveAesKeyFrom(
    kekBytes,
    HKDF_LABEL_WRAP_MAIN,
    ['encrypt'],
  );
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: textEncoder.encode(aad) as BufferSource,
    },
    wrapKey,
    mainKeyBytes as BufferSource,
  );
  return {
    wrappedMainKey: bytesToBase64(new Uint8Array(ciphertext)),
    wrappedMainKeyIv: bytesToBase64(iv),
  };
}

/** Unwrap the main key produced by {@link wrapMainKeyUnderKek}. */
export async function unwrapMainKeyUnderKek(
  wrap: MainKeyWrap,
  kekBytes: Uint8Array,
  aad: string,
): Promise<Uint8Array> {
  const wrapKey = await deriveAesKeyFrom(
    kekBytes,
    HKDF_LABEL_WRAP_MAIN,
    ['decrypt'],
  );
  const iv = base64ToBytes(wrap.wrappedMainKeyIv);
  const data = base64ToBytes(wrap.wrappedMainKey);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: textEncoder.encode(aad) as BufferSource,
    },
    wrapKey,
    data as BufferSource,
  );
  return new Uint8Array(plaintext);
}

/* ============================================================================
 * AAD builder
 * ========================================================================== */

/**
 * Domain-separation tags that go into the AAD. Adding a new tag is
 * fine; renaming an existing one is a hard fork — every wrapped row
 * with the old tag would fail to decrypt.
 */
export type FactorTag = 'password' | 'passkey' | 'recovery';

/**
 * Build the AAD string for a wrapped-KEK ciphertext. Format chosen
 * for stability + readability:
 *
 *     "nodea:v1\x1fuserId\x1ftag"
 *
 * The `\x1f` (Unit Separator) is rare in normal text and impossible
 * in a UUID, so it cleanly disambiguates fields without escaping.
 * The `nodea:v1` prefix lets a future schema bump (v2) stay
 * incompatible with v1 ciphertexts on purpose.
 */
export function buildKekAAD(userId: string, tag: FactorTag): string {
  return `nodea:v1\x1f${userId}\x1f${tag}`;
}

/** AAD for the main-key wrap (no factor tag — there's only one main key per user). */
export function buildMainKeyAAD(userId: string): string {
  return `nodea:v1\x1f${userId}\x1fmain`;
}

/**
 * AAD for a passkey-wrapped KEK. Adds the credential id as a 4th
 * component so each passkey's wrap is bound to its own credential —
 * a server-side row swap between two of the same user's passkeys
 * fails the auth-tag check at decrypt time. Auth-Spec §9.2 prescribes
 * this 3-tuple format (`users.id || "passkey" || credential_id`).
 *
 * `credentialIdB64Url` must be the canonical base64url of the raw
 * credential id bytes (no padding, URL-safe alphabet) — the same
 * encoding used to store `auth_factors.credential_id` server-side.
 * Both sides MUST agree on the encoding or every assertion fails.
 */
export function buildPasskeyAAD(userId: string, credentialIdB64Url: string): string {
  return `nodea:v1\x1f${userId}\x1fpasskey\x1f${credentialIdB64Url}`;
}
