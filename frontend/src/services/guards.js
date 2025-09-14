// Stocke les guards par collection et par record.id en localStorage.
// + Fournit deriveGuard(mainKeyRaw, moduleUserId, recordId) pour unifier l'usage
// (extrait depuis Mood.js).

const KEY = "nodea.guards.v1";

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function saveAll(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}

export function setEntryGuard(collection, id, guard) {
  const all = loadAll();
  all[collection] = all[collection] || {};
  all[collection][id] = String(guard || "");
  saveAll(all);
}

export function getEntryGuard(collection, id) {
  const all = loadAll();
  return all?.[collection]?.[id] || "";
}

export function deleteEntryGuard(collection, id) {
  const all = loadAll();
  if (all?.[collection]?.[id]) {
    delete all[collection][id];
    saveAll(all);
  }
}

/* ------------------------- deriveGuard (HMAC-SHA256) ------------------------- */
// Implémentation centrale pour tous les modules, déplacée depuis Mood.js.

const te = new TextEncoder();

function toHex(buf) {
  const b = new Uint8Array(buf || []);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

async function hmacSha256(keyRaw, messageUtf8) {
  // keyRaw: ArrayBuffer|Uint8Array (clé brute, pas CryptoKey)
  const key = await window.crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return window.crypto.subtle.sign("HMAC", key, te.encode(messageUtf8));
}

/**
 * Dérive le guard stable (prefixé "g_") pour une entrée.
 * @param {Uint8Array|ArrayBuffer} mainKeyRaw - 32 octets "bruts" (pas CryptoKey)
 * @param {string} moduleUserId
 * @param {string|number} recordId
 */
export async function deriveGuard(mainKeyRaw, moduleUserId, recordId) {
  if (
    mainKeyRaw &&
    typeof mainKeyRaw === "object" &&
    mainKeyRaw.type === "secret"
  ) {
    throw new Error(
      "deriveGuard attend la clé principale brute (Uint8Array). CryptoKey non supportée."
    );
  }
  if (!moduleUserId) throw new Error("module_user_id manquant");
  if (recordId == null) throw new Error("recordId manquant");

  // guardKey = HMAC(mainKey, "guard:"+module_user_id)
  const guardKeyBytes = await hmacSha256(mainKeyRaw, "guard:" + moduleUserId);
  // guard    = "g_" + HEX( HMAC(guardKey, record.id) )
  const tag = await hmacSha256(guardKeyBytes, String(recordId));
  return "g_" + toHex(tag);
}
