/**
 * Client-side cryptography primitives built on WebCrypto.
 * Exposes helpers for key derivation, AES-GCM encryption/decryption and error ergonomics.
 */
import Argon2 from "argon2-wasm";
import { ensureAesKey } from "./main-key";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// -------------------------------------------------------------
// Primitives crypto c?t? client (WebCrypto)
// -------------------------------------------------------------
// - deriveKeyArgon2: d?rive 32 octets via Argon2id (mot de passe + salt)
// - encryptAESGCM / decryptAESGCM: chiffrement sym?trique AES-GCM
// - bytesToBase64 / base64ToBytes: conversions binaires <-> base64 (standard)
// - randomBytes: g?n?ration d'octets al?atoires crypto-s?rs
// - decryptWithRetry + KeyMissingError: ergonomie de d?chiffrement
// -------------------------------------------------------------

/**
 * Derive a 32 byte key from a password + salt using Argon2id.
 *
 * @param {string} password - Raw password text.
 * @param {string | Uint8Array} salt - Base64/string salt or raw bytes.
 * @returns {Promise<Uint8Array>} Derived key bytes (32 bytes).
 */
export async function deriveKeyArgon2(password, salt) {
  let saltBytes;
  if (typeof salt === "string") {
    try {
      saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
    } catch {
      saltBytes = textEncoder.encode(salt);
    }
  } else {
    saltBytes = salt;
  }

  await Argon2.ready;
  const { hash } = await Argon2.hash({
    pass: password,
    salt: saltBytes,
    type: "Argon2id",
    hashLen: 32,
    time: 3,
    mem: 64 * 1024,
    parallelism: 1,
    raw: true,
  });

  return new Uint8Array(hash);
}

/**
 * Import raw bytes as a WebCrypto AES-GCM key.
 *
 * @param {ArrayBufferView | ArrayBuffer} bytes32 - 32 byte key material.
 * @returns {Promise<CryptoKey>} AES-GCM CryptoKey instance.
 */
export function importAesKeyFromBytes(bytes32) {
  return window.crypto.subtle.importKey(
    "raw",
    bytes32,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64) {
  const bin = atob(base64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    u8[i] = bin.charCodeAt(i);
  }
  return u8.buffer;
}

/**
 * Convert a byte array into a Base64 string.
 *
 * @param {Uint8Array} u8 - Raw bytes.
 * @returns {string} Base64 encoded string.
 */
export function bytesToBase64(u8) {
  return btoa(String.fromCharCode(...u8));
}

/**
 * Decode a Base64 string into bytes.
 *
 * @param {string} b64 - Base64 encoded string.
 * @returns {Uint8Array} Decoded bytes.
 */
export function base64ToBytes(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    u8[i] = bin.charCodeAt(i);
  }
  return u8;
}

async function resolveAesKey(material) {
  if (material && material.type === "secret" && material.algorithm?.name === "AES-GCM") {
    return material;
  }
  return ensureAesKey(material);
}

/**
 * Encrypt a UTF-8 string using AES-GCM.
 *
 * @param {string} plaintext - Clear text payload.
 * @param {CryptoKey | ArrayBufferView | ArrayBuffer} keyMaterial - AES key or material convertible to one.
 * @returns {Promise<{iv: string, data: string}>} Base64 encoded IV + cipher payload.
 */
export async function encryptAESGCM(plaintext, keyMaterial) {
  const key = await resolveAesKey(keyMaterial);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = textEncoder.encode(plaintext);
  const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    iv: arrayBufferToBase64(iv),
    data: arrayBufferToBase64(ciphertext),
  };
}

/**
 * Decrypt an AES-GCM payload previously produced by `encryptAESGCM`.
 *
 * @param {{iv: string, data: string}} encrypted - Base64 encoded IV + cipher payload.
 * @param {CryptoKey | ArrayBufferView | ArrayBuffer} keyMaterial - AES key or material convertible to one.
 * @returns {Promise<string>} Decrypted UTF-8 string.
 */
export async function decryptAESGCM(encrypted, keyMaterial) {
  const key = await resolveAesKey(keyMaterial);
  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
  const data = base64ToArrayBuffer(encrypted.data);
  const plaintextBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return textDecoder.decode(plaintextBuffer);
}

/**
 * Generate cryptographically secure random bytes.
 *
 * @param {number} length - Number of bytes required.
 * @returns {Uint8Array} Random byte array.
 */
export function randomBytes(length) {
  const u8 = new Uint8Array(length);
  window.crypto.getRandomValues(u8);
  return u8;
}

/**
 * Custom error raised when decryption fails due to missing or invalid key material.
 */
export class KeyMissingError extends Error {
  constructor(message = "Cl? dechiffrement manquante ou invalide") {
    super(message);
    this.name = "KeyMissingError";
  }
}

function isCryptoError(err) {
  return (
    err &&
    (err.name === "DataError" ||
      err.name === "OperationError" ||
      err.name === "InvalidAccessError" ||
      err.message?.includes("key") ||
      err.message?.includes("CryptoKey"))
  );
}

/**
 * Attempt to decrypt a payload and retry once before surfacing a `KeyMissingError`.
 *
 * @param {{encrypted: {iv: string, data: string}, key: CryptoKey | ArrayBufferView | ArrayBuffer, markMissing?: () => void}} params - Decryption inputs.
 * @returns {Promise<string>} Decrypted UTF-8 payload.
 * @throws {KeyMissingError} When both attempts fail because of key issues.
 */
export async function decryptWithRetry({ encrypted, key, markMissing }) {
  try {
    return await decryptAESGCM(encrypted, key);
  } catch (err) {
    if (isCryptoError(err)) {
      if (import.meta?.env?.DEV) console.warn("CRYPTO:retry", err);
      try {
        return await decryptAESGCM(encrypted, key);
      } catch (err2) {
        if (isCryptoError(err2)) {
          if (typeof markMissing === "function") markMissing();
          throw new KeyMissingError();
        }
        throw err2;
      }
    }
    throw err;
  }
}
