// crypto-utils.js
// -------------------------------------------------------------
// Petit toolkit côté client, basé sur WebCrypto, pour :
//   - encodage base64url
//   - génération aléatoire sécurisée
//   - hash (SHA-256) et HMAC
//   - IDs et secrets conformes à ton schéma PocketBase
//
// Fonctions exposées :
//   - toBase64url(bytes), fromBase64url(str)
//   - textToBytes(str), bytesToText(u8)
//   - randomBytes(n), randomSecret(n)
//   - hashPayload(input)          -> base64url
//   - hmac(secretBytes, message)  -> base64url
//   - generateModuleUserId(prefix='g_') -> "g_" + [a-z0-9_-]{16,}
//   - makeGuard() -> "g_" + 32 hex (pattern ^g_[a-z0-9]{32,}$)
// -------------------------------------------------------------

const subtle = globalThis.crypto?.subtle;
if (!subtle) {
  throw new Error(
    "WebCrypto indisponible : crypto.subtle est requis côté client."
  );
}

const te = new TextEncoder();
const td = new TextDecoder();

/** ---------------- Encodage ---------------- **/

export function toBase64url(bytes) {
  // bytes -> base64url (sans =) ; OK pour URL et patterns PB.
  let s = btoa(String.fromCharCode(...bytes));
  s = s.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return s;
}

export function fromBase64url(s) {
  // base64url -> bytes
  s = s.replaceAll("-", "+").replaceAll("_", "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}

export const textToBytes = (s) => te.encode(s);
export const bytesToText = (u8) => td.decode(u8);

/** ---------------- Aléa sécurisé ---------------- **/

export function randomBytes(n = 32) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

// alias pratique pour nommage “secret”
export const randomSecret = (n = 32) => randomBytes(n);

/** ---------------- Hash & HMAC (base64url) ---------------- **/

export async function hashPayload(input) {
  // input: string | Uint8Array | objet JSON
  const bytes =
    input instanceof Uint8Array
      ? input
      : typeof input === "string"
      ? te.encode(input)
      : te.encode(JSON.stringify(input));

  const digest = await subtle.digest("SHA-256", bytes);
  return toBase64url(new Uint8Array(digest));
}

export async function hmac(secretBytes, message, algo = "SHA-256") {
  // secretBytes: Uint8Array ; message: string | Uint8Array
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

/** ---------------- IDs & tokens conformes au schéma PB ---------------- **/

export function generateModuleUserId(prefix = "g_") {
  // Schéma PB : ^[a-z0-9_\\-]{16,}$
  // 12 octets -> 16 chars base64url ; on force en minuscules pour matcher le pattern.
  const raw = randomBytes(12);
  const id = toBase64url(raw).toLowerCase(); // [a-z0-9_-], pas de '='
  return prefix ? prefix + id : id; // ex: "g_manctvf3kzv-tn72"
}

export function bytesToHex(u8) {
  return [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function makeGuard() {
  // Schéma PB : ^g_[a-z0-9]{32,}$
  // 16 octets -> 32 hex ; préfixe "g_"
  return "g_" + bytesToHex(randomBytes(16));
}
