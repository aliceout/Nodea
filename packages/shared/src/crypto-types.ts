/**
 * Branded types for the crypto surface.
 *
 * These exist so the compiler can distinguish between values that share the
 * same runtime representation but carry different semantics (e.g. a raw
 * base64 vs a base64url, or an AES CryptoKey vs an HMAC CryptoKey). Passing
 * one where the other is expected must fail at compile time.
 *
 * Use {@link brand} to tag a raw value as a branded type. Branding does not
 * change the runtime value — it only narrows the compile-time type.
 */

/** Base64 string (standard alphabet: A-Z a-z 0-9 + /), may contain `=` padding. */
export type Base64 = string & { readonly __brand: 'Base64' };

/** Base64url string (URL-safe: `-` and `_`), no padding. */
export type Base64Url = string & { readonly __brand: 'Base64Url' };

/** A base64-encoded AES-GCM IV (96 bits → 12 bytes → 16 chars b64). */
export type CipherIV = Base64 & { readonly __ivBrand: 'CipherIV' };

/** A base64-encoded AES-GCM ciphertext blob (includes auth tag). */
export type EncryptedBlob = Base64 & { readonly __blobBrand: 'EncryptedBlob' };

/** An AES-GCM `CryptoKey` derived via HKDF for payload encryption. */
export type AesMainKey = CryptoKey & { readonly __keyBrand: 'AesMainKey' };

/** An HMAC-SHA-256 `CryptoKey` derived via HKDF for guard computation. */
export type HmacMainKey = CryptoKey & { readonly __keyBrand: 'HmacMainKey' };

/**
 * Tag a raw value with a branded type. Runtime-noop; compile-time only.
 *
 * @example
 *   const b64 = brand<Base64>(rawString);
 */
export function brand<B extends { readonly __brand: string }>(value: Omit<B, '__brand'>): B {
  return value as B;
}
