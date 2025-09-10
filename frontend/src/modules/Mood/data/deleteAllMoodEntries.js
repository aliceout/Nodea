// Supprime toutes les entrées Mood pour un module_user_id donné
// Log chaque étape (id, guard, status, erreurs)
import { listMoodEntries, deleteMoodEntry, deriveGuard } from "./moodEntries";

/**
 * Supprime toutes les entrées Mood pour un module_user_id donné
 * @param {string} moduleUserId
 * @param {Uint8Array|CryptoKey} mainKey
 */
export async function deleteAllMoodEntries(moduleUserId, mainKey) {
  const moodEntries = await listMoodEntries(moduleUserId);
  for (const entry of moodEntries) {
    try {
      const guard = await deriveGuard(mainKey, moduleUserId, entry.id);
      console.log(`[deleteAllMoodEntries] Try deleteMoodEntry id=${entry.id} guard=${guard}`);
      const res = await deleteMoodEntry(entry.id, moduleUserId, guard);
      console.log(`[deleteAllMoodEntries] deleteMoodEntry status:`, res?.status ?? res);
    } catch (err) {
      console.warn(`[deleteAllMoodEntries] deleteMoodEntry failed for id=${entry.id} guard, retry with 'init'`, err);
      try {
        const res2 = await deleteMoodEntry(entry.id, moduleUserId, "init");
        console.log(`[deleteAllMoodEntries] Retry deleteMoodEntry id=${entry.id} guard=init status:`, res2?.status ?? res2);
      } catch (err2) {
        console.error(`[deleteAllMoodEntries] Suppression Mood échouée pour id=${entry.id} guard=init`, err2);
      }
    }
  }
}
