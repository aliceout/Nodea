// frontend/src/modules/Passage/data/passageEntries.js
import pb from "@/services/pocketbase";
import { encryptAESGCM } from "@/services/webcrypto";
import { decryptWithRetry } from "@/services/decryptWithRetry";
import {
  setEntryGuard,
  getEntryGuard,
  deleteEntryGuard,
} from "@/services/guards";

const COLLECTION = "passage_entries";

/* ------------------------- Helpers HMAC (aligné Mood) ------------------------- */
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
/** mainKeyRaw = Uint8Array (pas CryptoKey) */
export async function deriveGuard(mainKeyRaw, moduleUserId, recordId) {
  const guardKeyBytes = await hmacSha256(mainKeyRaw, "guard:" + moduleUserId);
  const tag = await hmacSha256(guardKeyBytes, String(recordId));
  return "g_" + toHex(tag);
}
/** force en Uint8Array (requis pour HMAC) */
function toRawBytes(mk) {
  if (mk instanceof Uint8Array) return mk;
  if (mk?.buffer) return new Uint8Array(mk.buffer);
  // Si mk est une CryptoKey non-extractible → on ne peut pas dériver un guard
  if (
    mk &&
    typeof mk === "object" &&
    mk.type === "secret" &&
    !("buffer" in mk)
  ) {
    throw new Error(
      "MainKey non exploitable pour HMAC (clé non-extractible). Reconnecte-toi."
    );
  }
  return new Uint8Array(mk || []);
}

/* --------------------------------- CREATE ---------------------------------- */
/**
 * Crée une entrée Passage (payload chiffré), POST guard:"init", puis PATCH promotion guard.
 * @param {string} moduleUserId - sid
 * @param {Uint8Array|CryptoKey} mainKey
 * @param {object} payloadObj - { type, date, thread, title?, content, ... }
 */
export async function createPassageEntry(moduleUserId, mainKey, payloadObj) {
  // 1) chiffrer le payload
  const plaintext = JSON.stringify(payloadObj || {});
  const sealed = await encryptAESGCM(plaintext, mainKey); // -> { iv, data }

  // 2) CREATE avec guard:"init"
  const res = await pb.send(
    `/api/collections/${COLLECTION}/records?sid=${encodeURIComponent(
      moduleUserId
    )}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        module_user_id: String(moduleUserId),
        payload: sealed.data,
        cipher_iv: sealed.iv,
        guard: "init",
      }),
    }
  );

  const created = res?.json || res;
  const id = created?.id;
  if (!id) throw new Error("Création Passage: id manquant");

  // 3) Promotion guard init -> g_...
  const guard = await deriveGuard(toRawBytes(mainKey), moduleUserId, id);
  await pb.send(
    `/api/collections/${COLLECTION}/records/${encodeURIComponent(
      id
    )}?sid=${encodeURIComponent(moduleUserId)}&d=init`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guard }),
    }
  );

  // garder localement (optimise update/delete)
  setEntryGuard(COLLECTION, id, guard);
  return { id, guard };
}

/* ---------------------------------- LIST ----------------------------------- */
/**
 * Liste brute (non déchiffrée) de la collection Passage.
 */
export async function listPassageEntries(
  moduleUserId,
  { page = 1, perPage = 50, sort = "-created" } = {}
) {
  const url = `/api/collections/${COLLECTION}/records?page=${page}&perPage=${perPage}&sort=${encodeURIComponent(
    sort
  )}&sid=${encodeURIComponent(moduleUserId)}`;
  const list = await pb.send(url, { method: "GET" });
  const data = list?.json || list;
  return data?.items || [];
}

/**
 * Déchiffre 1 record (signature identique à Mood : {iv,data} → decryptWithRetry).
 */
export async function decryptPassageRecord(rec, mainKey) {
  if (!rec?.payload || !rec?.cipher_iv) return null;

  // IMPORTANT: aligné Mood → decryptWithRetry attend { iv, data } + key
  const encrypted = { iv: rec.cipher_iv, data: rec.payload };

  // comme Mood: passe par decryptWithRetry (gère clé manquante, etc.)
  const plaintext = await decryptWithRetry({ encrypted, key: mainKey });
  const obj = JSON.parse(plaintext || "{}");

  return {
    id: rec.id,
    created: rec.created,
    updated: rec.updated,
    payload: obj,
  };
}

/**
 * Liste paginée + déchiffrée (conserve l’ordre du tri backend).
 */
export async function listPassageDecrypted(
  moduleUserId,
  mainKey,
  { pages = 3, perPage = 100, sort = "-created" } = {}
) {
  const out = [];
  let firstError = null;

  for (let p = 1; p <= pages; p++) {
    const pageItems = await listPassageEntries(moduleUserId, {
      page: p,
      perPage,
      sort,
    });
    if (!pageItems?.length) break;
    for (const rec of pageItems) {
      try {
        const dec = await decryptPassageRecord(rec, mainKey);
        if (dec) out.push(dec);
      } catch (e) {
        if (!firstError) firstError = e; // mémorise la 1ère erreur
      }
    }
  }

  if (firstError) out._firstError = firstError; // ← c’est ce que ton History lit
  return out;
}


/**
 * Extrait la liste distincte des "threads" (hashtags / histoires) existants (déchiffrés).
 */
export async function listDistinctThreads(
  moduleUserId,
  mainKey,
  { pages = 2, perPage = 100, sort = "-created" } = {}
) {
  const set = new Set();
  for (let p = 1; p <= pages; p++) {
    const pageItems = await listPassageEntries(moduleUserId, {
      page: p,
      perPage,
      sort,
    });
    if (!pageItems?.length) break;
    for (const rec of pageItems) {
      try {
        const dec = await decryptPassageRecord(rec, mainKey);
        const th = dec?.payload?.thread;
        if (th && typeof th === "string") set.add(th);
      } catch {}
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/* --------------------------------- UPDATE ---------------------------------- */
export async function updatePassageEntry(
  id,
  moduleUserId,
  mainKey,
  payloadObj
) {
  // retrouver/préparer le guard
  const gLocal = getEntryGuard(COLLECTION, id);
  const guard =
    gLocal || (await deriveGuard(toRawBytes(mainKey), moduleUserId, id));

  // re-chiffrer
  const sealed = await encryptAESGCM(JSON.stringify(payloadObj || {}), mainKey);

  const url = `/api/collections/${COLLECTION}/records/${encodeURIComponent(
    id
  )}?sid=${encodeURIComponent(moduleUserId)}&d=${encodeURIComponent(guard)}`;

  const res = await pb.send(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload: sealed.data, cipher_iv: sealed.iv }),
  });

  setEntryGuard(COLLECTION, id, guard);
  return res?.json || res;
}

/* --------------------------------- DELETE ---------------------------------- */
export async function deletePassageEntry(id, moduleUserId, mainKey) {
  const gLocal = getEntryGuard(COLLECTION, id);
  const guard =
    gLocal || (await deriveGuard(toRawBytes(mainKey), moduleUserId, id));

  const url = `/api/collections/${COLLECTION}/records/${encodeURIComponent(
    id
  )}?sid=${encodeURIComponent(moduleUserId)}&d=${encodeURIComponent(guard)}`;

  try {
    const res = await pb.send(url, { method: "DELETE" });
    deleteEntryGuard(COLLECTION, id);
    return res?.json || res;
  } catch (_e) {
    // fallback ultime: tentative avec d=init (si l’entrée n’a jamais été promue)
    const urlInit = `/api/collections/${COLLECTION}/records/${encodeURIComponent(
      id
    )}?sid=${encodeURIComponent(moduleUserId)}&d=init`;
    const res2 = await pb.send(urlInit, { method: "DELETE" });
    deleteEntryGuard(COLLECTION, id);
    return res2?.json || res2;
  }
}
