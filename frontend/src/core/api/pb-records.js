/**
 * Shared helpers to query and create encrypted records in PocketBase collections.
 * Handles guard derivation and validation for module scoped records.
 */
import pb from "@/core/api/pocketbase";
import { deriveGuard } from "@/core/crypto/guards";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";

/**
 * List PocketBase records for a collection with module scoping.
 *
 * @param {string} collection - PocketBase collection name.
 * @param {{sid?: string, page?: number, perPage?: number, sort?: string, fields?: string}} [options] - Pagination and filtering options.
 * @returns {Promise<any>} Raw response payload from PocketBase.
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
 * Create an encrypted record and immediately derive its guard.
 *
 * @param {{
 *   collection: string,
 *   moduleUserId: string,
 *   payloadString: string,
 *   iv: string,
 *   mainKey: CryptoKey | Uint8Array
 * }} params - Record creation inputs.
 * @returns {Promise<string | undefined>} Newly created record id.
 */
export async function createEncryptedRecord({
  collection,
  moduleUserId,
  payloadString,
  iv,
  mainKey,
}) {
  if (!collection) throw new Error("createEncryptedRecord: collection manquante");
  if (!moduleUserId)
    throw new Error("createEncryptedRecord: moduleUserId manquant");
  if (!payloadString || !iv)
    throw new Error("createEncryptedRecord: payload/iv manquant");
  if (!hasMainKeyMaterial(mainKey))
    throw new Error("createEncryptedRecord: mainKey manquante");

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

export default { listRecords, createEncryptedRecord };
