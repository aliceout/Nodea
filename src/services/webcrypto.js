import Argon2 from "argon2-wasm";

/**
 * Dérive une clé (Uint8Array) à partir du mot de passe et du salt, via Argon2id (argon2-wasm).
 * @param {string} password - Le mot de passe en clair.
 * @param {string} salt - Le salt (base64, utf8 ou Uint8Array).
 * @returns {Promise<Uint8Array>} - La clé dérivée (32 bytes = 256 bits pour AES).
 */
export async function deriveKeyArgon2(password, salt) {
  // argon2-wasm attend un Uint8Array pour le salt
  let saltBytes;
  if (typeof salt === "string") {
    try {
      // tente décodage base64
      saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
    } catch {
      // fallback utf8
      saltBytes = new TextEncoder().encode(salt);
    }
  } else {
    saltBytes = salt;
  }
  await Argon2.ready;
  const { hash } = await Argon2.hash({
    pass: password,
    salt: saltBytes,
    type: "Argon2id", // Changement : on passe la string "Argon2id"
    hashLen: 32,
    time: 3,
    mem: 64 * 1024, // 64MB
    parallelism: 1,
    raw: true,
  });
  return new Uint8Array(hash);
}
// --- Encodage base64 ↔ ArrayBuffer ---
function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const buffer = new Uint8Array(len);
  for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i);
  return buffer.buffer;
}

// --- Chiffrement AES-GCM ---
/**
 * Chiffre une chaîne de texte en AES-GCM (WebCrypto), retourne un objet { iv, data } (base64).
 * @param {string} plaintext
 * @param {CryptoKey} key - CryptoKey WebCrypto, issue de deriveKey/importKey.
 * @returns {Promise<{iv: string, data: string}>}
 */
export async function encryptAESGCM(plaintext, key) {
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
 * Déchiffre un objet { iv, data } (base64) en texte clair.
 * @param {{iv: string, data: string}} encrypted
 * @param {CryptoKey} key
 * @returns {Promise<string>}
 */
export async function decryptAESGCM(encrypted, key) {
  const iv = base64ToArrayBuffer(encrypted.iv);
  const data = base64ToArrayBuffer(encrypted.data);
  const plaintextBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    data
  );
  return new TextDecoder().decode(plaintextBuffer);
}
