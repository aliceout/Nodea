// frontend/src/modules/Passage/data/passageEntries.js
import pb from "@/services/pocketbase";
import { encryptAESGCM } from "@/services/webcrypto";
import {
  setEntryGuard,
  getEntryGuard,
  deleteEntryGuard,
} from "@/services/guards";

const COLLECTION = "passage_entries";

/* ------------------------- Helpers HMAC (mêmes que Mood) ------------------------- */
const te = new TextEncoder();

function toHex(buf) {
  const b = new Uint8Array(buf || []);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

async function hmacSha256(keyRaw, messageUtf8) {
  const key = await window.crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return window.crypto.subtle.sign("HMAC", key, te.encode(messageUtf8));
}

export async function deriveGuard(mainKeyRaw, moduleUserId, recordId) {
  const guardKeyBytes = await hmacSha256(mainKeyRaw, "guard:" + moduleUserId);
  const tag = await hmacSha256(guardKeyBytes, String(recordId));
  return "g_" + toHex(tag);
}

/* ------------------------------ CREATE (2 temps) ------------------------------ */
/**
 * Crée une entrée Passage (payload chifré, POST guard:"init", puis PATCH promotion guard)
 * @param {string} moduleUserId - sid
 * @param {Uint8Array|CryptoKey} mainKey
 * @param {object} payloadObj - objet clair (sera JSON.stringify puis AES-GCM)
 */
export async function createPassageEntry(moduleUserId, mainKey, payloadObj) {
  // 1) chiffrer le payload
  const plaintext = JSON.stringify(payloadObj || {});
  const sealed = await encryptAESGCM(plaintext, mainKey); // -> { iv, data }

  // 2) POST avec guard:"init"
  const createRes = await pb.send(
    `/api/collections/${COLLECTION}/records?sid=${encodeURIComponent(
      moduleUserId
    )}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        module_user_id: moduleUserId,
        payload: sealed.data,
        cipher_iv: sealed.iv,
        guard: "init",
      }),
    }
  );

  const rec = createRes?.json || createRes; // selon wrapper pb.send
  const id = rec?.id;
  if (!id) throw new Error("Création Passage: id manquant");

  // 3) Promotion du guard (PATCH)
  const g = await deriveGuard(mainKey, moduleUserId, id);
  await pb.send(
    `/api/collections/${COLLECTION}/records/${encodeURIComponent(
      id
    )}?sid=${encodeURIComponent(moduleUserId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guard: g }),
    }
  );

  // 4) Mémoriser localement le guard (facultatif mais pratique)
  setEntryGuard(COLLECTION, id, g);

  return { id };
}

/* ------------------------------ LIST ------------------------------ */
/**
 * Liste paginée brute (métadonnées, pas déchiffrée)
 */
export async function listPassageEntries(
  moduleUserId,
  { page = 1, perPage = 50, sort = "-created" } = {}
) {
  const url = `/api/collections/${COLLECTION}/records?page=${page}&perPage=${perPage}&sort=${encodeURIComponent(
    sort
  )}&sid=${encodeURIComponent(moduleUserId)}`;
  const list = await pb.send(url, { method: "GET" });
  return list?.json?.items || list?.items || [];
}

/* ------------------------------ UPDATE ------------------------------ */
/**
 * Met à jour le payload (ré-enchiffre) — requiert le guard effectif (?d=)
 */
export async function updatePassageEntry(
  id,
  moduleUserId,
  mainKey,
  payloadObj
) {
  const gLocal = getEntryGuard(COLLECTION, id);
  const guard = gLocal || (await deriveGuard(mainKey, moduleUserId, id));

  const sealed = await encryptAESGCM(JSON.stringify(payloadObj || {}), mainKey);
  const url = `/api/collections/${COLLECTION}/records/${encodeURIComponent(
    id
  )}?sid=${encodeURIComponent(moduleUserId)}&d=${encodeURIComponent(guard)}`;

  return pb.send(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload: sealed.data, cipher_iv: sealed.iv }),
  });
}

/* ------------------------------ DELETE ------------------------------ */
export async function deletePassageEntry(id, moduleUserId, mainKey) {
  const gLocal = getEntryGuard(COLLECTION, id);
  const guard = gLocal || (await deriveGuard(mainKey, moduleUserId, id));
  const url = `/api/collections/${COLLECTION}/records/${encodeURIComponent(
    id
  )}?sid=${encodeURIComponent(moduleUserId)}&d=${encodeURIComponent(guard)}`;

  try {
    const res = await pb.send(url, { method: "DELETE" });
    deleteEntryGuard(COLLECTION, id);
    return res;
  } catch (err) {
    // fallback si la promo n’a jamais eu lieu et que l’enregistrement est resté "init"
    const urlInit = `/api/collections/${COLLECTION}/records/${encodeURIComponent(
      id
    )}?sid=${encodeURIComponent(moduleUserId)}&d=init`;
    const res2 = await pb.send(urlInit, { method: "DELETE" });
    deleteEntryGuard(COLLECTION, id);
    return res2;
  }
}
