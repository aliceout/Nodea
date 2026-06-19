/**
 * Server-side replicas of `packages/web/src/core/crypto/factor-wrap.ts`
 * for callers that don't have a browser handy: the admin seed
 * (`seed.ts`), per-module data seeders (`seed-mood.ts`), and the
 * test helpers' OPAQUE-aware `seedUser` / `seedAdmin` (test/helpers.ts).
 *
 * Keeps the HKDF labels, AAD format, and AES-GCM construction
 * byte-for-byte identical to the web implementation so blobs
 * produced here are interchangeable with what the browser produces.
 *
 * Phase 2D scope:
 *   - `loginUnwrapMainKey` runs an in-process OPAQUE login round-trip
 *     (no HTTP, no session emitted) to derive `exportKey` from a
 *     password + persisted envelope, then walks the wrap chain back
 *     to the main key bytes. Used by `seed-mood.ts` to encrypt
 *     fixtures under the user's actual main key.
 *   - `wrapMainKeyAndKek` does the inverse (fresh KEK + main key,
 *     wrapped under a freshly-registered OPAQUE exportKey). Used by
 *     the admin seed and by test helpers.
 */
import { webcrypto } from 'node:crypto';
import { client, ready } from '@serenity-kit/opaque';
import { startLogin as opaqueServerStartLogin } from './opaque.ts';

const HKDF_LABEL_WRAP_KEK = 'nodea:wrap-kek';
const HKDF_LABEL_WRAP_MAIN = 'nodea:wrap-main';
const textEncoder = new TextEncoder();

/* ============================================================================
 * Encoding helpers
 * ========================================================================== */

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export function base64UrlToBytes(b64url: string): Uint8Array {
  const pad = (4 - (b64url.length % 4)) % 4;
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export function freshBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  webcrypto.getRandomValues(out);
  return out;
}

/* ============================================================================
 * AAD format — same as `packages/web/src/core/crypto/factor-wrap.ts`
 * ========================================================================== */

export function buildKekAAD(userId: string): string {
  // V1 only wraps under password (no passkey or recovery yet from the
  // server side), so the tag is hard-coded here. Web exposes a richer
  // factor union for Phase 4+.
  return `nodea:v1\x1f${userId}\x1fpassword`;
}

export function buildMainKeyAAD(userId: string): string {
  return `nodea:v1\x1f${userId}\x1fmain`;
}

/* ============================================================================
 * AES-GCM + HKDF primitives
 * ========================================================================== */

async function deriveAesKey(
  ikm: Uint8Array,
  label: string,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const ikmKey = await webcrypto.subtle.importKey(
    'raw',
    ikm as BufferSource,
    'HKDF',
    false,
    ['deriveBits'],
  );
  const subkey = await webcrypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0) as BufferSource,
      info: textEncoder.encode(label) as BufferSource,
    },
    ikmKey,
    32 * 8,
  );
  const key = await webcrypto.subtle.importKey('raw', subkey, { name: 'AES-GCM' }, false, usage);
  // Node 24's webcrypto.CryptoKey widened its KeyUsage union with the
  // post-quantum (ML-KEM) literals, so it no longer assigns to the DOM
  // global CryptoKey. The key object is identical at runtime — narrow the
  // type back so the shared `CryptoKey` annotation holds across helpers.
  return key as CryptoKey;
}

async function aesGcmEncrypt(
  plaintext: Uint8Array,
  key: CryptoKey,
  aad: string,
): Promise<{ data: string; iv: string }> {
  const iv = freshBytes(12);
  const ct = await webcrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: textEncoder.encode(aad) as BufferSource,
    },
    key,
    plaintext as BufferSource,
  );
  return { data: bytesToBase64(new Uint8Array(ct)), iv: bytesToBase64(iv) };
}

async function aesGcmDecrypt(
  data: string,
  iv: string,
  key: CryptoKey,
  aad: string,
): Promise<Uint8Array> {
  const plain = await webcrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(iv) as BufferSource,
      additionalData: textEncoder.encode(aad) as BufferSource,
    },
    key,
    base64ToBytes(data) as BufferSource,
  );
  return new Uint8Array(plain);
}

/* ============================================================================
 * High-level: OPAQUE register + main key wrap (used by seeds + tests)
 * ========================================================================== */

export interface OpaqueRegisterResult {
  /** OPAQUE registration record to persist in `opaque_records.envelope`. */
  registrationRecord: string;
  /** AES-GCM ciphertext of a freshly-generated 32-byte main key
   *  under a freshly-generated KEK. Persist as
   *  `users.wrapped_main_key{,_iv}`. */
  wrappedMainKey: string;
  wrappedMainKeyIv: string;
  /** AES-GCM ciphertext of the same KEK under an HKDF sub-key of
   *  the OPAQUE exportKey. Persist as
   *  `users.wrapped_kek_password{,_iv}`. */
  wrappedKekPassword: string;
  wrappedKekPasswordIv: string;
}

/**
 * Run a full OPAQUE register handshake in process and produce the
 * three blobs the route would normally receive from the browser.
 *
 * Caller is responsible for the DB writes (transactional INSERT
 * into `users` + `opaque_records`).
 */
export async function opaqueRegister(input: {
  userId: string;
  email: string;
  password: string;
}): Promise<OpaqueRegisterResult> {
  await ready;

  const { clientRegistrationState, registrationRequest } = client.startRegistration({
    password: input.password,
  });
  const { createRegistrationResponse } = await import('./opaque.ts');
  const { registrationResponse } = createRegistrationResponse({
    userIdentifier: input.email.toLowerCase(),
    registrationRequest,
  });
  const { registrationRecord, exportKey } = client.finishRegistration({
    password: input.password,
    clientRegistrationState,
    registrationResponse,
  });

  const kek = freshBytes(32);
  const mainKey = freshBytes(32);
  try {
    const mainKeyKey = await deriveAesKey(kek, HKDF_LABEL_WRAP_MAIN, ['encrypt']);
    const mainKeyWrap = await aesGcmEncrypt(mainKey, mainKeyKey, buildMainKeyAAD(input.userId));

    const kekKey = await deriveAesKey(
      base64UrlToBytes(exportKey),
      HKDF_LABEL_WRAP_KEK,
      ['encrypt'],
    );
    const kekWrap = await aesGcmEncrypt(kek, kekKey, buildKekAAD(input.userId));

    return {
      registrationRecord,
      wrappedMainKey: mainKeyWrap.data,
      wrappedMainKeyIv: mainKeyWrap.iv,
      wrappedKekPassword: kekWrap.data,
      wrappedKekPasswordIv: kekWrap.iv,
    };
  } finally {
    kek.fill(0);
    mainKey.fill(0);
  }
}

/* ============================================================================
 * High-level: OPAQUE login + main key unwrap (used by per-module seeders)
 * ========================================================================== */

export interface OpaqueLoginUnwrapInput {
  userId: string;
  email: string;
  password: string;
  /** OPAQUE registration record from `opaque_records.envelope`. */
  envelope: string;
  /** From `users.wrapped_main_key{,_iv}`. */
  wrappedMainKey: string;
  wrappedMainKeyIv: string;
  /** From `users.wrapped_kek_password{,_iv}`. */
  wrappedKekPassword: string;
  wrappedKekPasswordIv: string;
}

/**
 * Drive the OPAQUE login handshake in process (no HTTP, no session)
 * to derive `exportKey`, then walk the wrap chain back to the main
 * key. Throws on wrong password (auth-tag mismatch on decrypt).
 *
 * Caller owns the returned bytes — zero them with `.fill(0)` once
 * the derived sub-keys are in place.
 */
export async function opaqueLoginUnwrapMainKey(
  input: OpaqueLoginUnwrapInput,
): Promise<Uint8Array> {
  await ready;

  const { clientLoginState, startLoginRequest } = client.startLogin({
    password: input.password,
  });
  const { loginResponse } = opaqueServerStartLogin({
    userIdentifier: input.email.toLowerCase(),
    registrationRecord: input.envelope,
    startLoginRequest,
  });
  const finished = client.finishLogin({
    password: input.password,
    clientLoginState,
    loginResponse,
  });
  if (!finished) {
    throw new Error('opaqueLoginUnwrapMainKey: wrong password (client.finishLogin returned undefined)');
  }

  const kekKey = await deriveAesKey(
    base64UrlToBytes(finished.exportKey),
    HKDF_LABEL_WRAP_KEK,
    ['decrypt'],
  );
  const kekBytes = await aesGcmDecrypt(
    input.wrappedKekPassword,
    input.wrappedKekPasswordIv,
    kekKey,
    buildKekAAD(input.userId),
  );

  try {
    const mainKeyKey = await deriveAesKey(kekBytes, HKDF_LABEL_WRAP_MAIN, ['decrypt']);
    return await aesGcmDecrypt(
      input.wrappedMainKey,
      input.wrappedMainKeyIv,
      mainKeyKey,
      buildMainKeyAAD(input.userId),
    );
  } finally {
    kekBytes.fill(0);
  }
}
