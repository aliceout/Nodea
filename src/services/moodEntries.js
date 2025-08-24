// src/services/moodEntries.js
import { encryptAESGCM } from "@/services/webcrypto";
import { makeGuard } from "@/services/crypto-utils";

/**
 * @param {object} params
 * @param {import('pocketbase').default} params.pb
 * @param {string} params.moduleUserId
 * @param {CryptoKey|Uint8Array} params.mainKey
 * @param {object} params.payload - objet clair (date, mood_score, etc.)
 */
export async function createMoodEntry({ pb, moduleUserId, mainKey, payload }) {
  // s’assurer d’avoir une CryptoKey AES-GCM
  let cryptoKey = mainKey;
  if (!(cryptoKey instanceof CryptoKey)) {
    cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      mainKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // chiffrer le JSON
  const plaintext = JSON.stringify(payload);
  const { iv, data } = await encryptAESGCM(plaintext, cryptoKey);

  // écrire au schéma v2
  return pb.collection("mood_entries").create({
    module_user_id: moduleUserId,
    payload: data,
    cipher_iv: iv,
    guard: makeGuard(),
  });
}
