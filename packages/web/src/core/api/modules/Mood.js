import pb from "@/core/api/pocketbase";
import { encryptAESGCM } from "@/core/crypto/webcrypto";
import { deriveGuard } from "@/core/crypto/guards";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";

/**
 * Supprime toutes les entrees Mood pour un module_user_id donne.
 */
export async function deleteAllMoodEntries(moduleUserId, mainKey) {
  if (!moduleUserId) throw new Error("module_user_id manquant");
  if (!hasMainKeyMaterial(mainKey)) {
    throw new Error("Cle principale manquante pour la suppression en masse.");
  }

  const entries = await listMoodEntries(moduleUserId);
  for (const entry of entries) {
    try {
      const guard = await deriveGuard(mainKey, moduleUserId, entry.id);
      const res = await deleteMoodEntry(entry.id, moduleUserId, guard);
      console.log(
        "[deleteAllMoodEntries] deleteMoodEntry status:",
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
          `[deleteAllMoodEntries] Suppression Mood echouee pour id=${entry.id} guard=init`,
          err2
        );
      }
    }
  }
}

/**
 * Cree une entree Mood (chiffrement local, POST guard:"init", promotion HMAC).
 */
export async function createMoodEntry({
  pb: pbOverride,
  moduleUserId,
  mainKey,
  payload,
}) {
  if (!moduleUserId) throw new Error("module_user_id manquant");
  if (!hasMainKeyMaterial(mainKey)) throw new Error("mainKey manquante");

  const client = pbOverride || pb;
  const plaintext = JSON.stringify(payload || {});
  const { iv, data } = await encryptAESGCM(plaintext, mainKey);

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
    throw new Error("Creation incomplete (id manquant).");
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

  return created;
}

export async function listMoodEntries(moduleUserId) {
  if (!moduleUserId) throw new Error("module_user_id manquant");
  const url =
    "/api/collections/mood_entries/records" +
    `?sid=${encodeURIComponent(moduleUserId)}` +
    `&sort=-created&perPage=200`;
  const page = await pb.send(url, { method: "GET" });
  return Array.isArray(page?.items) ? page.items : [];
}

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

export { deriveGuard };




