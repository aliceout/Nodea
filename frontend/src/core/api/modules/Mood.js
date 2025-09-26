/**
 * dataModules/Mood.js — Services CRUD pour Mood
 *
 * Flux:
 *  - CREATE: chiffre -> POST guard:"init" -> PATCH promotion avec deriveGuard
 *  - LIST: GET ?sid, tri -created
 *  - DELETE: DELETE /{id}?sid&d=<guard>
 *  - Helpers: deleteAllMoodEntries, deriveGuard re-export
 *
 * Public API (principales): createMoodEntry, listMoodEntries, deleteMoodEntry
 */
/**
 * Supprime toutes les entrées Mood pour un module_user_id donné, avec logs détaillés.
 * @param {string} moduleUserId
 * @param {Uint8Array|CryptoKey} mainKey
 */
export async function deleteAllMoodEntries(moduleUserId, mainKey) {
  const entries = await listMoodEntries(moduleUserId);
  console.log(`[deleteAllMoodEntries] Mood: module_user_id=`, moduleUserId);
  for (const entry of entries) {
    try {
      const guard = await deriveGuard(mainKey, moduleUserId, entry.id);
      console.log(
        `[deleteAllMoodEntries] Try deleteMoodEntry id=${entry.id} guard=${guard}`
      );
      const res = await deleteMoodEntry(entry.id, moduleUserId, guard);
      console.log(
        `[deleteAllMoodEntries] deleteMoodEntry status:`,
        res?.status ?? res
      );
    } catch (err) {
      console.warn(
        `[deleteAllMoodEntries] deleteMoodEntry failed for id=${entry.id} guard, retry with 'init'`,
        err
      );
      try {
        const res2 = await deleteMoodEntry(entry.id, moduleUserId, "init");
        console.log(
          `[deleteAllMoodEntries] Retry deleteMoodEntry id=${entry.id} guard=init status:`,
          res2?.status ?? res2
        );
      } catch (err2) {
        console.error(
          `[deleteAllMoodEntries] Suppression Mood échouée pour id=${entry.id} guard=init`,
          err2
        );
      }
    }
  }
}
import pb from "@/core/api/pocketbase";
import { encryptAESGCM } from "@/core/crypto/webcrypto";
import { deriveGuard } from "@/core/crypto/guards";

/* ------------------------------ CREATE (2 temps, HMAC) ------------------------------ */
/**
 * Crée une entrée Mood (chiffre le payload, POST "init", puis PATCH de promotion HMAC).
 *
 * @param {object} params
 * @param {import('pocketbase').default} [params.pb] - client PB optionnel (par défaut on utilise l'import global)
 * @param {string} params.moduleUserId
 * @param {CryptoKey|Uint8Array|ArrayBuffer} params.mainKey - clé utilisateur (brute préférable pour le HMAC)
 * @param {object} params.payload - objet clair (date, mood_score, etc.)
 * @returns {Promise<object>} l'objet créé retourné par le POST (avec id, created, ...)
 */
export async function createMoodEntry({
  pb: pbOverride,
  moduleUserId,
  mainKey,
  payload,
}) {
  if (!moduleUserId) throw new Error("module_user_id manquant");
  if (!mainKey) throw new Error("mainKey manquante");

  const client = pbOverride || pb;

  // 1) Si mainKey est en bytes, on importe juste pour chiffrer (HMAC utilisera la clé brute plus tard)
  let aesKey = mainKey;
  if (!(mainKey && typeof mainKey === "object" && mainKey.type === "secret")) {
    aesKey = await window.crypto.subtle.importKey(
      "raw",
      mainKey,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );
  }

  // 2) Chiffre le payload
  const plaintext = JSON.stringify(payload || {});
  const { iv, data } = await encryptAESGCM(plaintext, aesKey);

  // 3) CREATE (étape A) : POST avec guard="init" (copié par le hook dans le champ hidden)
  const created = await client.send("/api/collections/mood_entries/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      module_user_id: String(moduleUserId),
      payload: String(data),
      cipher_iv: String(iv),
      guard: "init",
    }),
  });

  if (!created?.id) {
    throw new Error("Création incomplète (id manquant).");
  }

  // 4) Promotion (étape B) : calcule le guard HMAC et PATCH ?d=init
  //    ⚠️ Pour le HMAC il faut la clé brute; si mainKey est un CryptoKey non-extractible -> impossible.
  if (mainKey instanceof CryptoKey) {
    throw new Error(
      "MainKey fournie comme CryptoKey non exploitable pour HMAC. Fournis la clé brute (Uint8Array)."
    );
  }

  const guard = await deriveGuard(mainKey, moduleUserId, created.id);

  await client.send(
    `/api/collections/mood_entries/records/${encodeURIComponent(
      created.id
    )}?sid=${encodeURIComponent(moduleUserId)}&d=init`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guard }),
    }
  );

  return created; // id/created/...
}

/* ----------------------------------- LIST ----------------------------------- */
/** Liste les entrées Mood pour un module_user_id (les plus récentes d’abord). */
export async function listMoodEntries(moduleUserId) {
  if (!moduleUserId) throw new Error("module_user_id manquant");
  const url =
    "/api/collections/mood_entries/records" +
    `?sid=${encodeURIComponent(moduleUserId)}` +
    `&sort=-created&perPage=200`;
  const page = await pb.send(url, { method: "GET" });
  return Array.isArray(page?.items) ? page.items : [];
}

/* ---------------------------------- DELETE ---------------------------------- */
/** Supprime une entrée Mood par id, via ?sid & d=guard */
export async function deleteMoodEntry(id, moduleUserId, guard) {
  if (!id) throw new Error("id manquant");
  if (!moduleUserId) throw new Error("module_user_id manquant");
  if (!guard) throw new Error("guard manquant");

  const url =
    `/api/collections/mood_entries/records/${encodeURIComponent(id)}` +
    `?sid=${encodeURIComponent(moduleUserId)}` +
    `&d=${encodeURIComponent(guard)}`;

  return pb.send(url, { method: "DELETE" });
}

/* (optionnel) Si tu veux exposer le dérivé pour d'autres appels (ex. delete à la volée) */
export { deriveGuard };
