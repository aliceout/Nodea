/**
 * E2E "envelope" handling: wrap / unwrap the user's raw main-key bytes
 * under a KEK derived from their password + salt (argon2id).
 *
 * Single source for the serialisation format and for the password-based
 * wrap/unwrap dance. Register / Login / ChangePassword all use these.
 */
import type {
  AesMainKey,
  Base64,
  CipherIV,
  EncryptedBlob,
} from '@nodea/shared';
import { base64ToBytes, bytesToBase64, randomBytes } from './base64.ts';
import { deriveKeyArgon2 } from './argon2.ts';
import { encryptAESGCM, decryptAESGCM, type AesBlob } from './aes.ts';

/**
 * Serialisation format for the wrapped main key = `"<iv>.<data>"`, both
 * base64. Kept as a single string on the server (`users.encryptedKey`)
 * so the API surface doesn't need a structured JSON blob.
 */
export function serialiseEnvelope(blob: AesBlob): string {
  return `${blob.iv}.${blob.data}`;
}

export function parseEnvelope(envelope: string): AesBlob {
  const dot = envelope.indexOf('.');
  if (dot < 0) throw new Error('malformed encrypted-key envelope');
  return {
    iv: envelope.slice(0, dot) as Base64 as CipherIV,
    data: envelope.slice(dot + 1) as Base64 as EncryptedBlob,
  };
}

async function importKek(bytes: Uint8Array, usage: KeyUsage[]): Promise<AesMainKey> {
  return (await crypto.subtle.importKey(
    'raw',
    bytes as BufferSource,
    { name: 'AES-GCM' },
    false,
    usage,
  )) as AesMainKey;
}

/**
 * Wrap raw main-key bytes under a fresh salt + the password-derived KEK.
 * Returns the pair `{ encryptionSalt, encryptedKey }` ready to ship to
 * the server.
 *
 * The caller keeps ownership of `mainKeyBytes` and is responsible for
 * zeroing them when done.
 */
export async function wrapMainKey(
  password: string,
  mainKeyBytes: Uint8Array,
): Promise<{ encryptionSalt: string; encryptedKey: string }> {
  const saltBytes = randomBytes(16);
  const kekBytes = await deriveKeyArgon2({ password, salt: saltBytes });
  try {
    const kek = await importKek(kekBytes, ['encrypt']);
    const blob = await encryptAESGCM(bytesToBase64(mainKeyBytes), kek);
    return {
      encryptionSalt: bytesToBase64(saltBytes),
      encryptedKey: serialiseEnvelope(blob),
    };
  } finally {
    kekBytes.fill(0);
  }
}

/**
 * Decrypt the stored envelope back to raw main-key bytes.
 *
 * Throws on wrong password (AES-GCM auth-tag mismatch) — catching this
 * is a reliable way to prove the user knows the current password
 * client-side, in addition to the server's argon2 check.
 *
 * The returned buffer is sensitive: callers should pass it through
 * `deriveMainKeys` and zero it immediately afterwards.
 */
export async function unwrapMainKeyBytes(
  password: string,
  encryptionSalt: string,
  encryptedKey: string,
): Promise<Uint8Array> {
  const saltBytes = base64ToBytes(encryptionSalt);
  const kekBytes = await deriveKeyArgon2({ password, salt: saltBytes });
  try {
    const kek = await importKek(kekBytes, ['decrypt']);
    const blob = parseEnvelope(encryptedKey);
    const plaintextB64 = await decryptAESGCM(blob, kek);
    return base64ToBytes(plaintextB64);
  } finally {
    kekBytes.fill(0);
  }
}
