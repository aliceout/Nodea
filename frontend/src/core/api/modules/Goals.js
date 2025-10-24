// Services CRUD pour Goals - creation 2 temps + guard HMAC (aligne Mood/Passage)
// Public API: listGoals, listGoalsPaged, getGoalById, createGoal, updateGoal, deleteGoal, updateGoalStatus

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
