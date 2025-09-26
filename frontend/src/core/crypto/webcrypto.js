import Argon2 from "argon2-wasm";

// webcrypto.js
// -------------------------------------------------------------
// Primitives crypto côté client (WebCrypto):
// - deriveKeyArgon2: dérivation de clé (Argon2id) à partir d'un mot de passe + salt
// - importAesKeyFromBytes: import d'une clé AES-GCM 256 depuis 32 octets bruts
// - encryptAESGCM / decryptAESGCM: chiffrement symétrique (AES-GCM)
// - bytesToBase64 / base64ToBytes: encodage binaire <-> Base64 (standard)
// - randomBytes: génération d'octets aléatoires crypto-sûrs
// - decryptWithRetry + KeyMissingError: ergonomie de déchiffrement (retry + message clair)
//
// Notes:
// - Base64 ici est la variante standard (avec +/ et =) adaptée au stockage JSON.
// - Pour Base64URL (pour IDs, URLs), utiliser services/crypto/crypto-utils.js.
// - deriveKeyArgon2 renvoie des octets bruts (Uint8Array) — idéal pour AES et HMAC côté client.
// -------------------------------------------------------------

/**
 * Dérive 32 octets (Uint8Array) via Argon2id à partir d'un mot de passe + salt.
 * Accepte un salt en base64, utf8, ou Uint8Array.
 */
/**
 * Dérive 32 octets (Uint8Array) via Argon2id à partir d'un mot de passe + salt.
 * @param {string} password - mot de passe en clair (UTF-8)
 * @param {string|Uint8Array} salt - base64 ou UTF-8 ou bytes
 * @returns {Promise<Uint8Array>} 32 octets (clé brute)
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
/** Bytes -> Base64 (standard) */
export function bytesToBase64(u8) {
  return btoa(String.fromCharCode(...u8));
}
/** Base64 (standard) -> Bytes */
export function base64ToBytes(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/** Normalise une clé fournie: CryptoKey ou Uint8Array -> CryptoKey */
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
/**
 * Chiffre une chaîne en AES-GCM.
 * @param {string} plaintext - texte clair (UTF-8)
 * @param {CryptoKey|Uint8Array} keyOrBytes - CryptoKey AES-GCM OU 32 octets "raw"
 * @returns {{iv:string, data:string}} base64 standard
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
/** Génère des octets aléatoires (utile pour clé principale & salt). */
export function randomBytes(length) {
  const u8 = new Uint8Array(length);
  window.crypto.getRandomValues(u8);
  return u8;
}

/**
 * Erreur spécifique lorsque la clé principale est absente/incorrecte
 */
/**
 * Erreur spécifique lorsque la clé principale est absente/incorrecte.
 * Interprétée par l'UI pour signaler une session sans clé.
 */
export class KeyMissingError extends Error {
  constructor(message = "Clé de chiffrement manquante ou invalide") {
    super(message);
    this.name = "KeyMissingError";
  }
}

/**
 * Détecte des erreurs typiques WebCrypto qui suggèrent une clé invalide
 */
/** Détecte des erreurs typiques WebCrypto suggérant une clé invalide */
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
 * Déchiffre avec retry 1x sur erreur crypto, sinon jette immédiatement
 * @param {Object} args - { encrypted: {iv,data}, key, markMissing? }
 * @returns {Promise<string>} texte clair
 */
/**
 * Déchiffre avec retry 1x sur erreur crypto, sinon lève KeyMissingError.
 * @param {{ encrypted:{iv:string,data:string}, key:CryptoKey|Uint8Array, markMissing?:Function }} args
 * @returns {Promise<string>} texte clair
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
