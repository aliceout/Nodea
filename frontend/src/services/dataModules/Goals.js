// frontend/src/services/dataModules/Goals.js
// Module Goals — service data (à l’économie, même flux que Mood/Passage)

import pb from "@/services/pocketbase";
import { loadModulesConfig } from "@/services/modules-config";
// On réutilise le helper existant qui suit la spec SECURITY.md
import { deriveGuard } from "@/services/guards";
// Chiffrement E2E commun (déjà utilisé côté app)
import { encryptAESGCM, decryptAESGCM } from "@/services/webcrypto";

const COLLECTION = "goals_entries";

/** Récupère le module_user_id (sid) du module Goals. */
async function getSid() {
  const cfg = await loadModulesConfig();
  const sid = cfg?.goals?.module_user_id;
  if (!sid)
    throw new Error("Module 'Goals' non configuré (module_user_id manquant).");
  return sid;
}

/** Helper: déchiffre un record PocketBase -> payload clair fusionné + métadonnées utiles. */
async function toEntry(mainKey, rec) {
  const { id, payload, cipher_iv, created, updated } = rec;
  const clear = await decryptAESGCM(mainKey, payload, cipher_iv);
  let data;
  try {
    data = JSON.parse(clear);
  } catch (e) {
    console.error("Payload JSON invalide (Goals):", e);
    data = {};
  }
  return {
    id,
    created,
    updated,
    // Champs métier (cf. documentation/modules/Goals.md)
    date: data.date || "",
    title: data.title || "",
    note: data.note || "",
    status: data.status || "open",
    categories: Array.isArray(data.categories) ? data.categories : [],
    // on ne renvoie jamais guard
  };
}

/** Helper: chiffre un payload clair {date,title,note?,status,categories[]} */
async function fromPayload(mainKey, payloadObj) {
  const clear = JSON.stringify(payloadObj ?? {});
  const { payload, iv } = await encryptAESGCM(mainKey, clear);
  return { payload, cipher_iv: iv };
}

/** LIST — renvoie toutes les entrées déchiffrées du module Goals. */
export async function listGoals(mainKey, { perPage = 200 } = {}) {
  const sid = await getSid();

  // On passe par pb.send pour injecter ?sid=...
  const res = await pb.send(
    `/api/collections/${COLLECTION}/records?sid=${encodeURIComponent(
      sid
    )}&perPage=${perPage}`,
    { method: "GET" }
  );

  const items = Array.isArray(res?.items) ? res.items : [];
  const out = [];
  for (const rec of items) {
    out.push(await toEntry(mainKey, rec));
  }
  return out;
}

/** GET by id — lit une entrée et la déchiffre. */
export async function getGoalById(mainKey, id) {
  const sid = await getSid();

  const rec = await pb.send(
    `/api/collections/${COLLECTION}/records/${encodeURIComponent(
      id
    )}?sid=${encodeURIComponent(sid)}`,
    { method: "GET" }
  );

  return toEntry(mainKey, rec);
}

/** CREATE — création en 2 temps (guard:"init" → PATCH promotion). */
export async function createGoal(mainKey, payload) {
  const sid = await getSid();

  const { payload: enc, cipher_iv } = await fromPayload(mainKey, payload);

  // 1) POST init
  const created = await pb.send(`/api/collections/${COLLECTION}/records`, {
    method: "POST",
    body: {
      module_user_id: sid,
      payload: enc,
      cipher_iv,
      guard: "init",
    },
  });

  // 2) PATCH promotion (calcul guard selon SECURITY.md)
  const guard = await deriveGuard(mainKey, sid, created.id);
  await pb.send(
    `/api/collections/${COLLECTION}/records/${
      created.id
    }?sid=${encodeURIComponent(sid)}&d=init`,
    {
      method: "PATCH",
      body: { guard },
    }
  );

  // Retourne l’entrée déchiffrée
  return toEntry(mainKey, created);
}

/** UPDATE — met à jour une entrée (payload complet) avec ?sid & d=<guard>. */
export async function updateGoal(mainKey, id, prevEntry, payload) {
  const sid = await getSid();

  const { payload: enc, cipher_iv } = await fromPayload(mainKey, payload);
  const guard = await deriveGuard(mainKey, sid, id);

  const rec = await pb.send(
    `/api/collections/${COLLECTION}/records/${encodeURIComponent(
      id
    )}?sid=${encodeURIComponent(sid)}&d=${encodeURIComponent(guard)}`,
    {
      method: "PATCH",
      body: {
        payload: enc,
        cipher_iv,
      },
    }
  );

  return toEntry(mainKey, rec);
}

/** UPDATE status — helper fin: open/doing/done/archived */
export async function updateGoalStatus(mainKey, id, prevEntry, nextStatus) {
  // On reconstruit un payload complet minimal, pour éviter de "perdre" des champs
  const payload = {
    date: prevEntry.date || "",
    title: prevEntry.title || "",
    note: prevEntry.note || "",
    status: nextStatus,
    categories: Array.isArray(prevEntry.categories) ? prevEntry.categories : [],
  };
  return updateGoal(mainKey, id, prevEntry, payload);
}

/** DELETE — supprime une entrée avec ?sid & d=<guard>. */
export async function deleteGoal(mainKey, id /*, prevEntry */) {
  const sid = await getSid();
  const guard = await deriveGuard(mainKey, sid, id);

  await pb.send(
    `/api/collections/${COLLECTION}/records/${encodeURIComponent(
      id
    )}?sid=${encodeURIComponent(sid)}&d=${encodeURIComponent(guard)}`,
    { method: "DELETE" }
  );

  return true;
}
