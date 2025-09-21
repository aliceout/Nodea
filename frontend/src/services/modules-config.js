// modules-config.js
// -------------------------------------------------------------
// Lecture / écriture de la config chiffrée des modules dans users.modules.
// La clé binaire (mainKey) vient de ton hook / logique existante.
// On ne change PAS ton style, ni tes composants : juste la logique.
//
// Schéma stocké (exemple):
// {
//   mood:  { enabled: true,  module_user_id: "g_xxx", guard: "g_...", algo: "v1" },
//   goals: { enabled: false, module_user_id: null,     guard: null,  algo: "v1" },
// }
// -------------------------------------------------------------

import {
  encryptAESGCM,
  decryptAESGCM,
  bytesToBase64,
  base64ToBytes,
} from "@/services/crypto/webcrypto";

// charge, déchiffre, retourne un objet JS
export async function loadModulesConfig(pb, userId, mainKey) {
  // 1) lire user
  const user = await pb.collection("users").getOne(userId);
  const raw = user.modules || null;
  if (!raw) return {}; // pas encore de config

  // raw = string JSON chiffré { cipher, iv }
  try {
    const parsed = JSON.parse(raw); // { iv, data } en base64
    const plaintext = await decryptAESGCM(
      { iv: parsed.iv, data: parsed.data },
      mainKey
    );
    return JSON.parse(plaintext || "{}");
  } catch {
    // si jamais l’ancien format ou vide
    return {};
  }
}

// prend un objet JS, chiffre et sauvegarde
export async function saveModulesConfig(pb, userId, mainKey, obj) {
  const plaintext = JSON.stringify(obj || {});
  const sealed = await encryptAESGCM(plaintext, mainKey); // => { iv, data }
  const payload = JSON.stringify(sealed);
  await pb.collection("users").update(userId, { modules: payload });
}

// helpers pour lire/écrire une entrée module
export function getModuleEntry(cfg, moduleId) {
  return (cfg && cfg[moduleId]) || null;
}

export function setModuleEntry(cfg, moduleId, entry) {
  const next = { ...(cfg || {}) };
  next[moduleId] = entry;
  return next;
}
