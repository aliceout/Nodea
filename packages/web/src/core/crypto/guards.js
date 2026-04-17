import { ensureHmacKey } from "./main-key";

const textEncoder = new TextEncoder();

function toHex(bytes) {
  const view = new Uint8Array(bytes || []);
  let out = "";
  for (let i = 0; i < view.length; i += 1) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}

async function importHmacKey(material) {
  if (material && material.type === "secret" && material.algorithm?.name === "HMAC") {
    return material;
  }
  return ensureHmacKey(material);
}

async function hmacSha256(keyMaterial, message) {
  const key = await importHmacKey(keyMaterial);
  const data =
    typeof message === "string" ? textEncoder.encode(message) : new Uint8Array(message || []);
  const signature = await window.crypto.subtle.sign("HMAC", key, data);
  return new Uint8Array(signature);
}

/**
 * Calcule le guard stable (préfixe "g_") pour un enregistrement.
 */
export async function deriveGuard(mainKeyMaterial, moduleUserId, recordId) {
  if (!moduleUserId) throw new Error("module_user_id manquant");
  if (recordId == null) throw new Error("recordId manquant");

  const guardKeyBytes = await hmacSha256(mainKeyMaterial, `guard:${moduleUserId}`);
  const tag = await hmacSha256(guardKeyBytes, String(recordId));
  return `g_${toHex(tag)}`;
}

// --- Cache local des guards (per collection/record) ---
const STORE_KEY = "nodea.guards.v1";

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAll(obj) {
  localStorage.setItem(STORE_KEY, JSON.stringify(obj));
}

export function clearGuardsCache() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
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

export default {
  deriveGuard,
  setEntryGuard,
  getEntryGuard,
  deleteEntryGuard,
  clearGuardsCache,
};

