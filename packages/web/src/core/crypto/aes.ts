/**
 * AES-GCM encryption / decryption using an `AesMainKey` sub-key derived
 * via HKDF from the user's main key material.
 *
 * The branded `AesMainKey` type prevents passing an HMAC sub-key by
 * mistake — the two are `CryptoKey` at runtime but distinct at compile
 * time.
 */
import type { AesMainKey, Base64, CipherIV, EncryptedBlob } from '@nodea/shared/crypto-types';
import { base64ToBytes, bytesToBase64, randomBytes } from './base64.ts';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface AesBlob {
  /** 12-byte IV, base64-encoded. */
  iv: CipherIV;
  /** AES-GCM ciphertext (includes 16-byte auth tag), base64-encoded. */
  data: EncryptedBlob;
}

/** Encrypt a UTF-8 string with AES-GCM-256 under the caller's AES sub-key. */
export async function encryptAESGCM(plaintext: string, key: AesMainKey): Promise<AesBlob> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    textEncoder.encode(plaintext) as BufferSource,
  );
  return {
    iv: bytesToBase64(iv) as Base64 as CipherIV,
    data: bytesToBase64(new Uint8Array(ciphertext)) as Base64 as EncryptedBlob,
  };
}

/** Decrypt an AES-GCM blob produced by {@link encryptAESGCM}. */
export async function decryptAESGCM(blob: AesBlob, key: AesMainKey): Promise<string> {
  const iv = base64ToBytes(blob.iv);
  const data = base64ToBytes(blob.data);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    data as BufferSource,
  );
  return textDecoder.decode(plaintext);
}
