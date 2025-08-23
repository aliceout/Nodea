// -------------------------------------------------------------
// Primitives WebCrypto + Argon2id (hash-wasm), compatibles avec
// l’API déjà utilisée par tes pages (encryptAESGCM(data, key),
// decryptAESGCM(payload, key) -> base64 string).
// -------------------------------------------------------------

import { argon2id } from "hash-wasm";

const subtle = globalThis.crypto?.subtle;
if (!subtle) throw new Error("WebCrypto indisponible : crypto.subtle requis.");

const te = new TextEncoder();
const td = new TextDecoder();

/** ---------------- Encoding helpers ---------------- **/
export function toBase64url(bytes) {
  let s = btoa(String.fromCharCode(...bytes));
  s = s.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return s;
}
export function fromBase64url(s) {
  if (typeof s !== "string") throw new Error("fromBase64url: string attendu");
  s = s.replaceAll("-", "+").replaceAll("_", "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}
export const textToBytes = (s) => te.encode(s);
export const bytesToText = (u8) => td.decode(u8);

/** ---------------- Secure randomness ---------------- **/
export function randomBytes(n = 32) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** ---------------- Hash & HMAC ---------------- **/
export async function hashSHA256(input) {
  const bytes = input instanceof Uint8Array ? input : te.encode(input);
  const digest = await subtle.digest("SHA-256", bytes);
  return toBase64url(new Uint8Array(digest));
}
export async function hmac(secretBytes, message, algo = "SHA-256") {
  const key = await subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: algo },
    false,
    ["sign"]
  );
  const msg = message instanceof Uint8Array ? message : te.encode(message);
  const sig = await subtle.sign("HMAC", key, msg);
  return toBase64url(new Uint8Array(sig));
}

/** ---------------- Argon2id (hash-wasm) ---------------- **/
/**
 * Dérive une clé depuis un mot de passe + sel.
 * - password: string | Uint8Array
 * - salt: Uint8Array | base64url string (auto-décodé si string)
 * Retour: Uint8Array (32 octets par défaut)
 */
export async function deriveKeyArgon2(password, salt, options = {}) {
  const {
    memoryCost = 64 * 1024, // KiB (64 MiB)
    timeCost = 3,
    parallelism = 1,
    hashLength = 32,
  } = options;

  const saltBytes =
    typeof salt === "string"
      ? fromBase64url(salt)
      : salt instanceof Uint8Array
      ? salt
      : textToBytes(String(salt));

  const out = await argon2id({
    password,
    salt: saltBytes,
    parallelism,
    iterations: timeCost,
    memorySize: memoryCost, // KiB
    hashLength,
    outputType: "binary", // => Uint8Array
  });

  return out;
}

/** ---------------- AES-GCM (compat API) ---------------- **/
async function ensureAesKey(keyOrRaw) {
  if (keyOrRaw?.type === "secret" && keyOrRaw?.algorithm?.name === "AES-GCM") {
    // CryptoKey déjà importé
    return keyOrRaw;
  }
  // Uint8Array ou ArrayBuffer -> import
  const raw =
    keyOrRaw instanceof Uint8Array
      ? keyOrRaw
      : keyOrRaw instanceof ArrayBuffer
      ? new Uint8Array(keyOrRaw)
      : (() => {
          throw new Error("Clé AES attendue (CryptoKey ou Uint8Array)");
        })();

  return subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * encryptAESGCM(data, keyOrRaw) -> { iv, data }
 * - data: string | Uint8Array
 * - keyOrRaw: CryptoKey AES-GCM OU Uint8Array (clé brute)
 * Retourne:
 *   { iv: base64url, data: base64url }  // NOTE: 'data' == ciphertext
 */
export async function encryptAESGCM(data, keyOrRaw) {
  const key = await ensureAesKey(keyOrRaw);
  const iv = randomBytes(12);
  const plaintext = data instanceof Uint8Array ? data : te.encode(String(data));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  // compat: 'data' (et non 'cipher')
  return { iv: toBase64url(iv), data: toBase64url(new Uint8Array(ct)) };
}

/**
 * decryptAESGCM(payload, keyOrRaw) -> base64String
 * - payload: { iv: base64url, data: base64url }
 * - keyOrRaw: CryptoKey AES-GCM OU Uint8Array (clé brute)
 * Retourne la **string base64** du plaintext (compat Login.jsx)
 */
export async function decryptAESGCM(payload, keyOrRaw) {
  const key = await ensureAesKey(keyOrRaw);
  const iv = fromBase64url(payload.iv);
  const cipher = fromBase64url(payload.data);
  const pt = await subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  // compat: renvoyer du base64 (non url-safe) car Login.jsx fait atob(...)
  const bytes = new Uint8Array(pt);
  return btoa(String.fromCharCode(...bytes));
}
