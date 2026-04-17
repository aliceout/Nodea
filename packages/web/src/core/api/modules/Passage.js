import pb from "@/core/api/pocketbase";
import { encryptAESGCM, decryptWithRetry } from "@/core/crypto/webcrypto";
import {
  deriveGuard,
  setEntryGuard,
  getEntryGuard,
  deleteEntryGuard,
} from "@/core/crypto/guards";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";

const COLLECTION = "passage_entries";

function assertMainKey(mainKey) {
  if (!hasMainKeyMaterial(mainKey)) {
    throw new Error("Cle principale manquante.");
  }
}

function assertModuleUserId(moduleUserId) {
  if (!moduleUserId) {
    throw new Error("module_user_id manquant");
  }
}

/**
 * Cree une entree Passage (payload chiffre), POST guard:"init", puis PATCH promotion guard.
 */
export async function createPassageEntry(moduleUserId, mainKey, payloadObj) {
  assertModuleUserId(moduleUserId);
  assertMainKey(mainKey);

  const plaintext = JSON.stringify(payloadObj || {});
  const sealed = await encryptAESGCM(plaintext, mainKey);

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
  if (!id) throw new Error("Creation Passage: id manquant");

  const guard = await deriveGuard(mainKey, moduleUserId, id);
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

  setEntryGuard(COLLECTION, id, guard);
  return created;
}

/**
 * Liste brute (non dechiffree) de la collection Passage.
 */
export async function listPassageEntries(
  moduleUserId,
  { page = 1, perPage = 50, sort = "-created" } = {}
) {
  assertModuleUserId(moduleUserId);
  const url =
    `/api/collections/${COLLECTION}/records` +
    `?page=${page}&perPage=${perPage}&sort=${encodeURIComponent(sort)}` +
    `&sid=${encodeURIComponent(moduleUserId)}`;
  const list = await pb.send(url, { method: "GET" });
  const data = list?.json || list;
  return data?.items || [];
}

/**
 * Dechiffre un record Passage (retourne payload imbrique).
 */
export async function decryptPassageRecord(rec, mainKey, { markMissing } = {}) {
  if (!rec?.payload || !rec?.cipher_iv) return null;
  assertMainKey(mainKey);

  const encrypted = { iv: rec.cipher_iv, data: rec.payload };
  const plaintext = await decryptWithRetry({
    encrypted,
    key: mainKey,
    markMissing,
  });

  let obj = {};
  try {
    obj = JSON.parse(plaintext || "{}");
  } catch (e) {
    console.warn("[Passage] JSON invalide pour record", rec?.id, e);
  }

  return {
    id: rec.id,
    created: rec.created,
    updated: rec.updated,
    payload: obj,
  };
}

/**
 * Liste paginee + dechiffree (conserve l'ordre du tri backend).
 */
export async function listPassageDecrypted(
  moduleUserId,
  mainKey,
  { pages = 3, perPage = 100, sort = "-created", markMissing } = {}
) {
  assertModuleUserId(moduleUserId);
  const out = [];
  let firstError = null;

  for (let p = 1; p <= pages; p += 1) {
    const pageItems = await listPassageEntries(moduleUserId, {
      page: p,
      perPage,
      sort,
    });
    if (!pageItems?.length) break;
    for (const rec of pageItems) {
      try {
        const dec = await decryptPassageRecord(rec, mainKey, { markMissing });
        if (dec) out.push(dec);
      } catch (err) {
        if (!firstError) firstError = err;
      }
    }
  }

  if (firstError) out._firstError = firstError;
  return out;
}

/**
 * Extrait la liste distincte des threads existants (dechiffres).
 */
export async function listDistinctThreads(
  moduleUserId,
  mainKey,
  { pages = 2, perPage = 100, sort = "-created", markMissing } = {}
) {
  const set = new Set();
  for (let p = 1; p <= pages; p += 1) {
    const pageItems = await listPassageEntries(moduleUserId, {
      page: p,
      perPage,
      sort,
    });
    if (!pageItems?.length) break;
    for (const rec of pageItems) {
      try {
        const dec = await decryptPassageRecord(rec, mainKey, { markMissing });
        const th = dec?.payload?.thread;
        if (th && typeof th === "string") set.add(th);
      } catch {
        // ignore
      }
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function updatePassageEntry(
  id,
  moduleUserId,
  mainKey,
  payloadObj
) {
  if (!id) throw new Error("id manquant");
  assertModuleUserId(moduleUserId);
  assertMainKey(mainKey);

  const gLocal = getEntryGuard(COLLECTION, id);
  const guard =
    gLocal || (await deriveGuard(mainKey, moduleUserId, id));

  const sealed = await encryptAESGCM(JSON.stringify(payloadObj || {}), mainKey);

  const url =
    `/api/collections/${COLLECTION}/records/${encodeURIComponent(id)}` +
    `?sid=${encodeURIComponent(moduleUserId)}&d=${encodeURIComponent(guard)}`;

  const res = await pb.send(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload: sealed.data, cipher_iv: sealed.iv }),
  });

  setEntryGuard(COLLECTION, id, guard);
  return res?.json || res;
}

export async function deletePassageEntry(id, moduleUserId, mainKey) {
  if (!id) throw new Error("id manquant");
  assertModuleUserId(moduleUserId);
  assertMainKey(mainKey);

  const gLocal = getEntryGuard(COLLECTION, id);
  const guard =
    gLocal || (await deriveGuard(mainKey, moduleUserId, id));

  const url =
    `/api/collections/${COLLECTION}/records/${encodeURIComponent(id)}` +
    `?sid=${encodeURIComponent(moduleUserId)}&d=${encodeURIComponent(guard)}`;

  try {
    const res = await pb.send(url, { method: "DELETE" });
    deleteEntryGuard(COLLECTION, id);
    return res?.json || res;
  } catch (_e) {
    const urlInit =
      `/api/collections/${COLLECTION}/records/${encodeURIComponent(id)}` +
      `?sid=${encodeURIComponent(moduleUserId)}&d=init`;
    const res2 = await pb.send(urlInit, { method: "DELETE" });
    deleteEntryGuard(COLLECTION, id);
    return res2?.json || res2;
  }
}
