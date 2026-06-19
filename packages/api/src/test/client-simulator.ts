/**
 * Minimal "client simulator" for integration tests.
 *
 * Reproduces what the web client does client-side (HKDF derivation, AES-GCM
 * encryption, guard HMAC) using Node's WebCrypto so tests can exercise the
 * full encrypted round-trip against the real API without importing the
 * web package.
 *
 * Not exported to production code. This exists only to prove the server
 * contract — the real client logic lives in `packages/web/src/core/crypto/`.
 */
import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface SimMainKeys {
  aesKey: CryptoKey;
  hmacKey: CryptoKey;
}

async function hkdfDerive(ikm: Uint8Array, label: string, bytes: number): Promise<Uint8Array> {
  const ikmKey = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const derived = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: enc.encode(label),
    },
    ikmKey,
    bytes * 8,
  );
  return new Uint8Array(derived);
}

export async function simDeriveMainKeys(rawBytes: Uint8Array): Promise<SimMainKeys> {
  const [aes, hmac] = await Promise.all([
    hkdfDerive(rawBytes, 'nodea:aes', 32),
    hkdfDerive(rawBytes, 'nodea:hmac', 32),
  ]);
  const aesKey = await subtle.importKey('raw', aes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  const hmacKey = await subtle.importKey(
    'raw',
    hmac,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  // Node 24's webcrypto.CryptoKey widened KeyUsage with post-quantum
  // (ML-KEM) literals, so the importKey results no longer assign to the
  // DOM global CryptoKey used in SimMainKeys. Same object at runtime.
  return { aesKey, hmacKey } as SimMainKeys;
}

function bytesToB64(u8: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < u8.length; i += 1) binary += String.fromCharCode(u8[i] ?? 0);
  return Buffer.from(binary, 'binary').toString('base64');
}

function b64ToBytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64'));
}

export async function simEncryptPayload(
  key: CryptoKey,
  payload: unknown,
): Promise<{ iv: string; data: string }> {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload)));
  return { iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(ciphertext)) };
}

export async function simDecryptPayload<T>(key: CryptoKey, iv: string, data: string): Promise<T> {
  const plain = await subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(iv) },
    key,
    b64ToBytes(data),
  );
  return JSON.parse(dec.decode(plain)) as T;
}

export async function simDeriveGuard(
  hmacKey: CryptoKey,
  moduleUserId: string,
  recordId: string,
): Promise<string> {
  const scoped = new Uint8Array(await subtle.sign('HMAC', hmacKey, enc.encode(`guard:${moduleUserId}`)));
  const scopedKey = await subtle.importKey(
    'raw',
    scoped,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const tag = new Uint8Array(await subtle.sign('HMAC', scopedKey, enc.encode(recordId)));
  let hex = '';
  for (let i = 0; i < tag.length; i += 1) hex += (tag[i] ?? 0).toString(16).padStart(2, '0');
  return `g_${hex}`;
}
