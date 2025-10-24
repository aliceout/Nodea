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

export function bytesToBase64(u8) {
  return btoa(String.fromCharCode(...u8));
}

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

export async function decryptAESGCM(encrypted, keyMaterial) {
  const key = await resolveAesKey(keyMaterial);
  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
  const data = base64ToArrayBuffer(encrypted.data);
  const plaintextBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return textDecoder.decode(plaintextBuffer);
}

export function randomBytes(length) {
  const u8 = new Uint8Array(length);
  window.crypto.getRandomValues(u8);
  return u8;
}

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

