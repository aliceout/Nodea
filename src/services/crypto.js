// crypto.js
// -------------------------------------------------------------
// Fonctions utilitaires autour du chiffrement symétrique (AES-GCM).
// Sert à sceller/dé-sceller des objets (seal/open) avec une clé binaire.
// Contient encore PBKDF2 (legacy, uniquement pour compatibilité).
// Pour toute nouvelle dérivation de clé, utiliser webcrypto.js (Argon2id).
// -------------------------------------------------------------

import CryptoJS from "crypto-js";

/** ---------------- Random helpers (crypto-safe) ---------------- **/

export function randomBytes(len = 32) {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return buf;
}

export function generateRandomKey(len = 32) {
  return randomBytes(len);
}

export function generateSalt(len = 16) {
  return randomBytes(len);
}

/** ---------------- Legacy PBKDF2 (déprécié) ---------------- **/

// ⚠️ Ne pas utiliser pour les nouveaux flux, préférer deriveKeyArgon2 de webcrypto.js
export function deriveProtectionKey(
  password,
  salt,
  iterations = 100000,
  keySize = 256
) {
  return CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(salt), {
    keySize: keySize / 32,
    iterations,
  }).toString(CryptoJS.enc.Hex);
}

/** ---------------- AES helpers ---------------- **/

export async function seal(data, key) {
  const iv = randomBytes(12);
  const algo = { name: "AES-GCM", iv };
  const cryptoKey = await crypto.subtle.importKey("raw", key, algo, false, [
    "encrypt",
  ]);

  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt(algo, cryptoKey, encoded);

  return {
    cipher: btoa(String.fromCharCode(...new Uint8Array(cipher))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function open({ cipher, iv }, key) {
  const algo = {
    name: "AES-GCM",
    iv: Uint8Array.from(atob(iv), (c) => c.charCodeAt(0)),
  };
  const cryptoKey = await crypto.subtle.importKey("raw", key, algo, false, [
    "decrypt",
  ]);

  const cipherBytes = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0));
  const plainBuf = await crypto.subtle.decrypt(algo, cryptoKey, cipherBytes);

  return JSON.parse(new TextDecoder().decode(plainBuf));
}
