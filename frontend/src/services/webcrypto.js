// src/services/webcrypto.js
import Argon2 from "argon2-wasm";

/**
 * Dérive 32 octets (Uint8Array) via Argon2id à partir d'un mot de passe + salt.
 * Accepte un salt en base64, utf8, ou Uint8Array.
 */
export async function deriveKeyArgon2(password, salt) {
  let saltBytes;
  if (typeof salt === "string") {
    // essaie base64, sinon utf8
    try {
      saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
    } catch {
      saltBytes = new TextEncoder().encode(salt);
    }
  } else {
    saltBytes = salt;
  }

  await Argon2.ready;
  const { hash } = await Argon2.hash({
    pass: password,
    salt: saltBytes,
    type: "Argon2id", // lib attend la string "Argon2id"
    hashLen: 32, // 256 bits pour AES-256
    time: 3,
    mem: 64 * 1024, // 64 MB
    parallelism: 1,
    raw: true,
  });

  return new Uint8Array(hash);
}

/** Importe 32 octets "raw" en CryptoKey AES-GCM 256 (non extractable). */
export function importAesKeyFromBytes(bytes32) {
  return window.crypto.subtle.importKey(
    "raw",
    bytes32,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Petits helpers base64 <-> ArrayBuffer/bytes */
function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
function base64ToArrayBuffer(base64) {
  const bin = atob(base64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}
export function bytesToBase64(u8) {
  return btoa(String.fromCharCode(...u8));
}
export function base64ToBytes(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/** Normalise une clé fournie: CryptoKey ou Uint8Array -> CryptoKey */
async function ensureCryptoKey(keyOrBytes) {
  if (
    keyOrBytes &&
    typeof keyOrBytes === "object" &&
    keyOrBytes.type === "secret"
  ) {
    // déjà une CryptoKey
    return keyOrBytes;
  }
  // sinon on considère que c'est un Uint8Array de 32 octets
  return importAesKeyFromBytes(keyOrBytes);
}

/**
 * Chiffre une chaîne en AES-GCM.
 * @param {string} plaintext - texte clair (UTF-8)
 * @param {CryptoKey|Uint8Array} keyOrBytes - CryptoKey AES-GCM OU 32 octets "raw"
 * @returns {{iv:string, data:string}} base64
 */
export async function encryptAESGCM(plaintext, keyOrBytes) {
  const key = await ensureCryptoKey(keyOrBytes);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  return {
    iv: arrayBufferToBase64(iv),
    data: arrayBufferToBase64(ciphertext),
  };
}

/**
 * Déchiffre un objet {iv,data} (base64) en texte clair (UTF-8).
 * @param {{iv:string, data:string}} encrypted
 * @param {CryptoKey|Uint8Array} keyOrBytes - CryptoKey AES-GCM OU 32 octets "raw"
 * @returns {Promise<string>}
 */
export async function decryptAESGCM(encrypted, keyOrBytes) {
  const key = await ensureCryptoKey(keyOrBytes);
  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
  const data = base64ToArrayBuffer(encrypted.data);
  const plaintextBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return new TextDecoder().decode(plaintextBuffer);
}

/** Génère des octets aléatoires (utile pour clé principale & salt). */
export function randomBytes(length) {
  const u8 = new Uint8Array(length);
  window.crypto.getRandomValues(u8);
  return u8;
}
