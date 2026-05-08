/**
 * Session-metadata encryption helpers — issue #47.
 *
 * Shipping a short, AAD-bound AES-GCM blob for the device label
 * shown next to each row in the « Sessions actives » UI. Privacy
 * invariant : the server never sees the cleartext label, only the
 * ciphertext + IV. AAD ties the blob to `users.id` so an opped
 * server can't migrate a label cipher between users (auth-tag
 * fails at decrypt).
 *
 * Reuses the AES sub-key already derived from the user's main key
 * (HKDF label `nodea:aes`, the same one module entries use). No new
 * sub-key needed — the AAD provides the domain separation we want.
 *
 * Why a dedicated file rather than extending `aes.ts` :
 * `aes.ts::encryptAESGCM` doesn't take an AAD (module entries
 * never used one — accepted historical gap). Adding AAD there
 * would change the AES-GCM contract for every existing caller.
 * This helper is opt-in : new callers (sessions UI today, future
 * encrypted small-metadata blobs tomorrow) get AAD from the start.
 */
import type {
  AesMainKey,
  Base64,
  CipherIV,
  EncryptedBlob,
} from '@nodea/shared/crypto-types';

import { base64ToBytes, bytesToBase64, randomBytes } from './base64.ts';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface EncryptedMeta {
  /** 12-byte IV, base64. Stored alongside `cipher` server-side. */
  iv: CipherIV;
  /** AES-GCM ciphertext (includes 16-byte auth tag), base64. */
  cipher: EncryptedBlob;
}

/** Encrypt a short UTF-8 string under the user's AES sub-key, with
 *  the supplied AAD bound to the auth-tag. */
export async function encryptMetaString(
  plaintext: string,
  key: AesMainKey,
  aad: string,
): Promise<EncryptedMeta> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: textEncoder.encode(aad) as BufferSource,
    },
    key,
    textEncoder.encode(plaintext) as BufferSource,
  );
  return {
    iv: bytesToBase64(iv) as Base64 as CipherIV,
    cipher: bytesToBase64(new Uint8Array(ciphertext)) as Base64 as EncryptedBlob,
  };
}

/** Decrypt a blob produced by {@link encryptMetaString}. Throws on
 *  AAD or auth-tag mismatch (caller passed wrong AAD or ciphertext
 *  is corrupt). */
export async function decryptMetaString(
  blob: EncryptedMeta,
  key: AesMainKey,
  aad: string,
): Promise<string> {
  const iv = base64ToBytes(blob.iv);
  const data = base64ToBytes(blob.cipher);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: textEncoder.encode(aad) as BufferSource,
    },
    key,
    data as BufferSource,
  );
  return textDecoder.decode(plaintext);
}
