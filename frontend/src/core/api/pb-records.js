// PocketBase records helpers
// - listRecords: uniform GET with sid/pagination
// - createEncryptedRecord: POST guard:"init" then PATCH promotion with deriveGuard

import pb from "@/core/api/pocketbase";
import { deriveGuard } from "@/core/crypto/guards";

/**
 * List records for a collection with sid, pagination, and optional fields sorting
 * Returns the raw JSON (items/totalItems) from pb.send or collection.getList shape.
 */
/**
 * Liste les enregistrements d'une collection avec pagination et sid.
 *
 * @param {string} collection - Nom de la collection PB (ex: "mood_entries").
 * @param {object} [opts]
 * @param {string} [opts.sid] - module_user_id (filtre serveur)
 * @param {number} [opts.page=1]
 * @param {number} [opts.perPage=200]
 * @param {string} [opts.sort="-created"]
 * @param {string} [opts.fields] - liste de champs (ex: "id,payload,cipher_iv")
 * @returns {Promise<{items:any[],page:number,perPage:number,totalItems:number,totalPages:number}>}
 */
export async function listRecords(
  collection,
  { sid, page = 1, perPage = 200, sort = "-created", fields } = {}
) {
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
    sort,
    sid: String(sid || ""),
  });
  if (fields) params.set("fields", fields);
  const url = `/api/collections/${collection}/records?${params.toString()}`;
  const res = await pb.send(url, { method: "GET" });
  return res?.json || res;
}

/**
 * Create encrypted record then promote guard using shared deriveGuard.
 * inputs: { collection, moduleUserId, payloadString, iv, mainKey }
 * Returns created record id.
 */
/**
 * Crée un record chiffré puis promeut le guard via HMAC partagé.
 *
 * Contrat PocketBase (hooks côté serveur):
 *  - Étape A (POST): body { module_user_id, payload, cipher_iv, guard:"init" }
 *  - Étape B (PATCH): /{id}?sid=<module_user_id>&d=init  body { guard: "g_<HMAC>" }
 *
 * @param {object} params
 * @param {string} params.collection
 * @param {string} params.moduleUserId - sid
 * @param {string} params.payloadString - ciphertext base64 (data)
 * @param {string} params.iv - IV AES-GCM base64
 * @param {Uint8Array} params.mainKey - clé principale brute (pour deriveGuard)
 * @returns {Promise<string>} id du record créé
 */
export async function createEncryptedRecord({
  collection,
  moduleUserId,
  payloadString,
  iv,
  mainKey,
}) {
  if (!collection)
    throw new Error("createEncryptedRecord: collection manquante");
  if (!moduleUserId)
    throw new Error("createEncryptedRecord: moduleUserId manquant");
  if (!payloadString || !iv)
    throw new Error("createEncryptedRecord: payload/iv manquant");
  if (!mainKey) throw new Error("createEncryptedRecord: mainKey manquante");

  // step A: POST with guard:init
  const created = await pb.send(`/api/collections/${collection}/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      module_user_id: String(moduleUserId),
      payload: String(payloadString),
      cipher_iv: String(iv),
      guard: "init",
    }),
  });

  // step B: derive guard and PATCH promotion
  const guard = await deriveGuard(mainKey, moduleUserId, created?.id);
  const params = new URLSearchParams({ sid: String(moduleUserId), d: "init" });
  await pb.send(
    `/api/collections/${collection}/records/${created.id}?${params.toString()}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guard }),
    }
  );

  return created?.id;
}

// --- Exemples d'utilisation ---
// (1) Lister les records chiffrés d'une collection (payload/cipher_iv)
//   const page = await listRecords("mood_entries", {
//     sid: moduleUserId,
//     fields: "id,payload,cipher_iv"
//   });
//
// (2) Créer un record chiffré (après encryptAESGCM)
//   const { iv, data } = await encryptAESGCM(JSON.stringify(clear), mainKey);
//   const id = await createEncryptedRecord({
//     collection: "mood_entries",
//     moduleUserId,
//     payloadString: data,
//     iv,
//     mainKey,
//   });

export default { listRecords, createEncryptedRecord };
