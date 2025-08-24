// src/services/moodEntries.js
import { decryptAESGCM } from "@/services/webcrypto";

// Normalise mainKey -> CryptoKey
export async function toAesKey(mainKey) {
  if (mainKey instanceof CryptoKey) return mainKey;
  return window.crypto.subtle.importKey(
    "raw",
    mainKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

// Déchiffre une entrée mood_entries (gère anciens/nouveaux formats)
export async function decryptMoodEntry(entry, aesKey) {
  // Cas A : nouveau format séparé
  if (
    entry?.cipher_iv &&
    typeof entry?.payload === "string" &&
    !entry.payload.trim().startsWith("{")
  ) {
    const obj = { iv: entry.cipher_iv, data: entry.payload };
    const clear = await decryptAESGCM(obj, aesKey);
    return JSON.parse(clear);
  }

  // Cas B : payload JSON {iv, data}
  const packed =
    typeof entry.payload === "string"
      ? JSON.parse(entry.payload)
      : entry.payload;
  const clear = await decryptAESGCM(packed, aesKey);
  return JSON.parse(clear);
}
