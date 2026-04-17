/**
 * Goals module service layer.
 * Handles encrypted CRUD operations backed by PocketBase and maintains guard integrity.
 * Public API: listGoals, listGoalsPaged, getGoalById, createGoal, updateGoal, deleteGoal, updateGoalStatus, listDistinctThreads.
 */
import pb from "@/core/api/pocketbase";
import { encryptAESGCM, decryptWithRetry } from "@/core/crypto/webcrypto";
import { deriveGuard } from "@/core/crypto/guards";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";

const COLLECTION = "goals_entries";
const SID_REGEX = /^[a-z0-9_\-]{16,}$/;

function assertMainKey(mainKey) {
  if (!hasMainKeyMaterial(mainKey)) {
    throw new Error("Cle principale manquante.");
  }
}

function assertSid(moduleUserId) {
  if (!moduleUserId) {
    throw new Error("Module 'Goals' non configure (module_user_id manquant).");
  }
  if (!SID_REGEX.test(String(moduleUserId))) {
    throw new Error("module_user_id invalide (format sid).");
  }
}

function pbError(e, fallback = "PocketBase error") {
  const msg =
    e?.data?.message || e?.response?.message || e?.message || fallback;
  const details = e?.data?.data ? ` ${JSON.stringify(e.data.data)}` : "";
  return new Error(`${msg}${details}`);
}

async function decryptRecord(mainKey, record, { markMissing } = {}) {
  if (!record) throw new Error("Record introuvable.");
  assertMainKey(mainKey);

  const plain = await decryptWithRetry({
    encrypted: {
      iv: String(record.cipher_iv),
      data: String(record.payload),
    },
    key: mainKey,
    markMissing,
  });
  const payload = JSON.parse(plain || "{}");
  return {
    id: record.id,
    created: record.created,
    updated: record.updated,
    ...payload,
  };
}

async function encryptPayload(mainKey, payloadObj) {
  assertMainKey(mainKey);
  const { data, iv } = await encryptAESGCM(
    JSON.stringify(payloadObj || {}),
    mainKey
  );
  return { data: String(data), iv: String(iv) };
}

/**
 * Convenience wrapper returning only the entries for the requested page.
 *
 * @param {string} moduleUserId - Module scoped SID.
 * @param {CryptoKey | Uint8Array} mainKey - Symmetric key for decryption.
 * @param {{page?: number, perPage?: number, sort?: string, markMissing?: () => void}} [options] - Pagination arguments.
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function listGoals(
  moduleUserId,
  mainKey,
  { page = 1, perPage = 50, sort = "-created", markMissing } = {}
) {
  const res = await listGoalsPaged(moduleUserId, mainKey, {
    page,
    perPage,
    sort,
    markMissing,
  });
  return res.items;
}

/**
 * List encrypted goal entries with pagination metadata.
 *
 * @param {string} moduleUserId - Module scoped SID.
 * @param {CryptoKey | Uint8Array} mainKey - Symmetric key for decryption.
 * @param {{page?: number, perPage?: number, sort?: string, markMissing?: () => void}} [options] - Pagination options.
 * @returns {Promise<{items: Array<Record<string, any>>, page: number, perPage: number, totalItems: number, totalPages: number}>}
 */
export async function listGoalsPaged(
  moduleUserId,
  mainKey,
  { page = 1, perPage = 50, sort = "-created", markMissing } = {}
) {
  assertSid(moduleUserId);

  const url = `/api/collections/${COLLECTION}/records?sid=${encodeURIComponent(
    moduleUserId
  )}&page=${page}&perPage=${perPage}&sort=${encodeURIComponent(sort)}`;

  let res;
  try {
    res = await pb.send(url, { method: "GET" });
  } catch (e) {
    throw pbError(e, "Echec de la liste goals_entries.");
  }

  const items = Array.isArray(res?.items) ? res.items : [];
  const decrypted = hasMainKeyMaterial(mainKey)
    ? await Promise.all(
        items.map((r) => decryptRecord(mainKey, r, { markMissing }))
      )
    : items;

  return {
    items: decrypted,
    page: res?.page ?? page,
    perPage: res?.perPage ?? perPage,
    totalItems: res?.totalItems ?? decrypted.length,
    totalPages: res?.totalPages ?? 1,
  };
}

/**
 * Retrieve and decrypt a goal entry by id.
 *
 * @param {string} moduleUserId - Module scoped SID.
 * @param {CryptoKey | Uint8Array} mainKey - Symmetric key for decryption.
 * @param {string} id - Record identifier.
 * @param {{markMissing?: () => void}} [options] - Optional callback when the key is missing.
 * @returns {Promise<Record<string, any>>}
 */
export async function getGoalById(
  moduleUserId,
  mainKey,
  id,
  { markMissing } = {}
) {
  assertMainKey(mainKey);
  assertSid(moduleUserId);
  if (!id) throw new Error("id manquant.");

  let rec;
  try {
    rec = await pb.send(
      `/api/collections/${COLLECTION}/records/${encodeURIComponent(
        id
      )}?sid=${encodeURIComponent(moduleUserId)}`,
      { method: "GET" }
    );
  } catch (e) {
    throw pbError(e, "Echec de la lecture de l'objectif.");
  }
  return decryptRecord(mainKey, rec, { markMissing });
}

/**
 * Create a new encrypted goal entry and promote its guard.
 *
 * @param {string} moduleUserId - Module scoped SID.
 * @param {CryptoKey | Uint8Array} mainKey - Symmetric key for encryption.
 * @param {Record<string, any>} payload - Goal payload.
 * @param {{markMissing?: () => void}} [options] - Optional callback when the key is missing.
 * @returns {Promise<Record<string, any>>} Newly created record (includes id and timestamps).
 */
export async function createGoal(moduleUserId, mainKey, payload) {
  assertMainKey(mainKey);
  assertSid(moduleUserId);

  const { data, iv } = await encryptPayload(mainKey, payload);

  let created;
  try {
    created = await pb.send(`/api/collections/${COLLECTION}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module_user_id: String(moduleUserId),
        payload: data,
        cipher_iv: iv,
        guard: "init",
      }),
    });
  } catch (e) {
    throw pbError(e, "Echec de la creation.");
  }

  if (!created?.id) throw new Error("Creation incomplete (id manquant).");

  const guard = await deriveGuard(mainKey, String(moduleUserId), created.id);

  try {
    await pb.send(
      `/api/collections/${COLLECTION}/records/${encodeURIComponent(
        created.id
      )}?sid=${encodeURIComponent(moduleUserId)}&d=init`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guard }),
      }
    );
  } catch (e) {
    throw pbError(e, "Echec de la promotion du guard.");
  }

  return created;
}

/**
 * Update an existing goal entry with a new payload.
 *
 * @param {string} moduleUserId - Module scoped SID.
 * @param {CryptoKey | Uint8Array} mainKey - Symmetric key for encryption.
 * @param {string} id - Record identifier.
 * @param {Record<string, any>} _prevEntry - Previously decrypted entry (unused placeholder).
 * @param {Record<string, any>} payload - New payload to persist.
 * @returns {Promise<{id: string}>}
 */
export async function updateGoal(
  moduleUserId,
  mainKey,
  id,
  _prevEntry,
  payload
) {
  assertMainKey(mainKey);
  assertSid(moduleUserId);
  if (!id) throw new Error("id manquant.");

  const { data, iv } = await encryptPayload(mainKey, payload);
  const guard = await deriveGuard(mainKey, String(moduleUserId), String(id));

  try {
    await pb.send(
      `/api/collections/${COLLECTION}/records/${encodeURIComponent(
        id
      )}?sid=${encodeURIComponent(moduleUserId)}&d=${encodeURIComponent(guard)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: data,
          cipher_iv: iv,
        }),
      }
    );
  } catch (e) {
    throw pbError(e, "Echec de la mise a jour.");
  }

  return { id };
}

/**
 * Delete a goal entry by id.
 *
 * @param {string} moduleUserId - Module scoped SID.
 * @param {CryptoKey | Uint8Array} mainKey - Symmetric key for guard derivation.
 * @param {string} id - Record identifier.
 * @param {Record<string, any>} _prevEntry - Previously decrypted entry (unused placeholder).
 * @returns {Promise<{id: string}>}
 */
export async function deleteGoal(moduleUserId, mainKey, id, _prevEntry) {
  assertMainKey(mainKey);
  assertSid(moduleUserId);
  if (!id) throw new Error("id manquant.");

  const guard = await deriveGuard(mainKey, String(moduleUserId), String(id));

  try {
    await pb.send(
      `/api/collections/${COLLECTION}/records/${encodeURIComponent(
        id
      )}?sid=${encodeURIComponent(moduleUserId)}&d=${encodeURIComponent(guard)}`,
      { method: "DELETE" }
    );
  } catch (e) {
    throw pbError(e, "Echec de la suppression.");
  }

  return { id };
}

/**
 * Update only the status attribute of a goal entry.
 *
 * @param {string} moduleUserId - Module scoped SID.
 * @param {CryptoKey | Uint8Array} mainKey - Symmetric key for encryption.
 * @param {string} id - Record identifier.
 * @param {"open"|"wip"|"done"} nextStatus - New status value.
 * @param {Record<string, any>} prevEntry - Optional cached entry to avoid refetch.
 * @returns {Promise<{id: string, noChange?: boolean}>}
 */
export async function updateGoalStatus(
  moduleUserId,
  mainKey,
  id,
  nextStatus,
  prevEntry
) {
  if (!["open", "wip", "done"].includes(nextStatus)) {
    throw new Error("Statut invalide.");
  }
  const base = prevEntry || (await getGoalById(moduleUserId, mainKey, id));
  if (!base) throw new Error("Entree introuvable.");
  if (base.status === nextStatus) return { id, noChange: true };

  const payload = {
    date: base.date || "",
    title: base.title || "",
    note: base.note || "",
    status: nextStatus,
    thread: base.thread || "",
  };

  return updateGoal(moduleUserId, mainKey, id, base, payload);
}

/**
 * Collect the distinct thread labels used across all goal entries.
 *
 * @param {string} moduleUserId - Module scoped SID.
 * @param {CryptoKey | Uint8Array} mainKey - Symmetric key for decryption.
 * @param {{markMissing?: () => void}} [options] - Optional callback when the key is missing.
 * @returns {Promise<string[]>} Alphabetically sorted unique thread names.
 */
export async function listDistinctThreads(
  moduleUserId,
  mainKey,
  { markMissing } = {}
) {
  try {
    const entries = await listGoals(moduleUserId, mainKey, {
      page: 1,
      perPage: 200,
      markMissing,
    });
    const set = new Set(
      entries
        .map((entry) => (entry.thread || "").trim())
        .filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  } catch (err) {
    if (import.meta?.env?.DEV) {
      console.warn("[Goals] listDistinctThreads error:", err);
    }
    return [];
  }
}
