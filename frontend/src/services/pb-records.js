// PocketBase records helpers
// - listRecords: uniform GET with sid/pagination
// - createEncryptedRecord: POST guard:"init" then PATCH promotion with deriveGuard

import pb from "@/services/pocketbase";
import { deriveGuard } from "@/services/crypto/guards";

/**
 * List records for a collection with sid, pagination, and optional fields sorting
 * Returns the raw JSON (items/totalItems) from pb.send or collection.getList shape.
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

export default { listRecords, createEncryptedRecord };
