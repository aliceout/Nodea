// frontend/src/services/dataModules/Goals.js
// Service CRUD du module Goals — aligné Mood/Passage (création 2 temps + guard HMAC)

import pb from "@/services/pocketbase";
import {
  encryptAESGCM,
  decryptAESGCM,
  base64ToBytes,
} from "@/services/webcrypto";
import { deriveGuard } from "@/services/guards";

const COLLECTION = "goals_entries";
// Pattern du schéma PB: "^[a-z0-9_\\-]{16,}$"
const SID_REGEX = /^[a-z0-9_\-]{16,}$/;

// -----------------------------------------------------------------------------
// Helpers internes
// -----------------------------------------------------------------------------

function assertMainKey(mainKey) {
  if (!mainKey) throw new Error("Clé principale manquante.");
}

function assertSid(moduleUserId) {
  if (!moduleUserId) {
    throw new Error("Module 'Goals' non configuré (module_user_id manquant).");
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

async function decryptRecord(mainKey, record) {
  if (!record) throw new Error("Record introuvable.");
  // Force mainKey en Uint8Array
  let keyBytes = mainKey;
  if (typeof mainKey === "string") {
    keyBytes = base64ToBytes(mainKey);
  }

  // Passe keyBytes à la crypto
  const plain = await decryptAESGCM(
    { iv: String(record.cipher_iv), data: String(record.payload) },
    keyBytes
  );
  const payload = JSON.parse(plain || "{}");
  return {
    id: record.id,
    created: record.created,
    updated: record.updated,
    ...payload,
  };
}

async function encryptPayload(mainKey, payloadObj) {
  // ✅ ORDRE Nodea: encryptAESGCM(plaintext, keyBytes)
  const { data, iv } = await encryptAESGCM(
    JSON.stringify(payloadObj || {}),
    mainKey
  );
  // encryptAESGCM renvoie base64url → on reste en string
  return { data: String(data), iv: String(iv) };
}

// -----------------------------------------------------------------------------
// LIST
// -----------------------------------------------------------------------------

/**
 * Liste simple (entrées déchiffrées), tri par défaut -created.
 */
export async function listGoals(
  moduleUserId,
  mainKey,
  { page = 1, perPage = 50, sort = "-created" } = {}
) {
  const res = await listGoalsPaged(moduleUserId, mainKey, {
    page,
    perPage,
    sort,
  });
  return res.items;
}

/**
 * Liste paginée (métadonnées PocketBase incluses).
 */
export async function listGoalsPaged(
  moduleUserId,
  mainKey,
  { page = 1, perPage = 50, sort = "-created" } = {}
) {
  assertSid(moduleUserId);

  const url = `/api/collections/${COLLECTION}/records?sid=${encodeURIComponent(
    moduleUserId
  )}&page=${page}&perPage=${perPage}&sort=${encodeURIComponent(sort)}`;

  let res;
  try {
    res = await pb.send(url, { method: "GET" });
  } catch (e) {
    throw pbError(e, "Échec de la liste goals_entries.");
  }

  const items = Array.isArray(res?.items) ? res.items : [];
  const decrypted = mainKey
    ? await Promise.all(items.map((r) => decryptRecord(mainKey, r)))
    : items;

  return {
    items: decrypted,
    page: res?.page ?? page,
    perPage: res?.perPage ?? perPage,
    totalItems: res?.totalItems ?? decrypted.length,
    totalPages: res?.totalPages ?? 1,
  };
}

// -----------------------------------------------------------------------------
// READ ONE
// -----------------------------------------------------------------------------

/**
 * GET /goals_entries/<id>?sid=<sid>
 */
export async function getGoalById(moduleUserId, mainKey, id) {
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
    throw pbError(e, "Échec de la lecture de l’objectif.");
  }
  return decryptRecord(mainKey, rec);
}

// -----------------------------------------------------------------------------
// CREATE (2 temps)
// -----------------------------------------------------------------------------

/**
 * 1) POST { guard:"init" } (createRule: @request.auth.id != "")
 * 2) PATCH promotion ?sid=...&d=init { guard }
 */
export async function createGoal(moduleUserId, mainKey, payload) {
  assertMainKey(mainKey);
  assertSid(moduleUserId);

  const { data, iv } = await encryptPayload(mainKey, payload);

  // Étape A — création init (sans ?sid, conforme au schéma)
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
    throw pbError(e, "Failed to create record.");
  }

  if (!created?.id) throw new Error("Création incomplète (id manquant).");

  // Étape B — promotion guard
  const guard = await deriveGuard(
    mainKey,
    String(moduleUserId),
    String(created.id)
  );
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
    throw pbError(e, "Failed to promote guard.");
  }

  return { id: created.id };
}

// -----------------------------------------------------------------------------
// UPDATE
// -----------------------------------------------------------------------------

/**
 * PATCH /<id>?sid=<sid>&d=<guard>
 * Rechiffre le payload complet.
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
      )}?sid=${encodeURIComponent(moduleUserId)}&d=${encodeURIComponent(
        guard
      )}`,
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
    throw pbError(e, "Échec de la mise à jour.");
  }

  return { id };
}

// -----------------------------------------------------------------------------
// DELETE
// -----------------------------------------------------------------------------

/**
 * DELETE /<id>?sid=<sid>&d=<guard>
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
      )}?sid=${encodeURIComponent(moduleUserId)}&d=${encodeURIComponent(
        guard
      )}`,
      { method: "DELETE" }
    );
  } catch (e) {
    throw pbError(e, "Échec de la suppression.");
  }

  return { id };
}

// -----------------------------------------------------------------------------
// Helper optionnel: changer uniquement le statut
// -----------------------------------------------------------------------------

export async function updateGoalStatus(
  moduleUserId,
  mainKey,
  id,
  nextStatus,
  prevEntry /* optionnel */
) {
  if (!["open", "wip", "done"].includes(nextStatus)) {
    throw new Error("Statut invalide.");
  }
  const base = prevEntry || (await getGoalById(moduleUserId, mainKey, id));
  if (!base) throw new Error("Entrée introuvable.");
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
