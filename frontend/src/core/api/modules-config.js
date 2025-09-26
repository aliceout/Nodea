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
  // bytesToBase64/base64ToBytes: utilitaires d'encodage binaire <-> base64.
  // Note: ici on ne les utilise pas directement car encrypt/decrypt retournent
  // et consomment déjà des strings base64 prêtes pour un JSON. On les laisse
  // importés si jamais un appelant externe souhaite manipuler des clés/salts en base64.
  bytesToBase64,
  base64ToBytes,
  KeyMissingError,
} from "@/core/crypto/webcrypto";

// charge, déchiffre, retourne un objet JS
/**
 * Charge et déchiffre la configuration des modules stockée dans users.modules.
 * - Lecture: users.modules est une string JSON contenant { iv, data } (base64)
 * - Déchiffrement: via AES-GCM avec la clé principale (mainKey)
 * - Retour: objet JS ({} si vide/format ancien)
 */
export async function loadModulesConfig(pb, userId, mainKey) {
  // 1) lire user
  const user = await pb.collection("users").getOne(userId);
  const raw = user.modules || null;
  if (!raw) return {}; // pas encore de config

  // Helper: normalise base64url -> base64 standard (compat ancien encodage)
  const toStdB64 = (s) => {
    if (typeof s !== "string") return s;
    let t = s.replaceAll("-", "+").replaceAll("_", "/");
    while (t.length % 4) t += "=";
    return t;
  };

  // raw peut être:
  //  - ancien format PLAINTEXT: JSON directement { mood:{...}, goals:{...} }
  //  - chiffré: JSON { iv, data } (base64 std) ou { iv, cipher } (legacy) ou base64url
  try {
    const parsed = JSON.parse(raw);

    // Cas 1: semble être une config en clair
    const keys =
      parsed && typeof parsed === "object" ? Object.keys(parsed) : [];
    const looksPlain =
      parsed &&
      typeof parsed === "object" &&
      !("iv" in parsed) &&
      !("data" in parsed) &&
      !("cipher" in parsed) &&
      keys.length > 0 &&
      keys.some(
        (k) =>
          parsed?.[k] &&
          typeof parsed[k] === "object" &&
          ("enabled" in parsed[k] || "module_user_id" in parsed[k])
      );
    if (looksPlain) return parsed;

    // Cas 2: chiffré { iv, data } (ou "cipher") possiblement en base64url
    const sealed = {
      iv: toStdB64(parsed.iv || ""),
      data: toStdB64(parsed.data || parsed.cipher || ""),
    };
    if (!sealed.iv || !sealed.data) return {};

    try {
      const plaintext = await decryptAESGCM(sealed, mainKey);
      const obj = JSON.parse(plaintext || "{}");
      if (import.meta?.env?.DEV) {
        try {
          const summary = Object.fromEntries(
            Object.entries(obj || {}).map(([k, v]) => [
              k,
              {
                enabled: !!v?.enabled,
                module_user_id: v?.module_user_id || null,
              },
            ])
          );
          console.log("[ModulesConfig] Loaded (DEV)", summary);
        } catch {}
      }
      return obj;
    } catch (err) {
      // Erreurs crypto → signaler clé manquante/invalide pour éviter un reseed silencieux
      if (
        err &&
        (err.name === "DataError" ||
          err.name === "OperationError" ||
          err.name === "InvalidAccessError" ||
          err.message?.toLowerCase?.().includes("key") ||
          err.message?.toLowerCase?.().includes("crypto"))
      ) {
        throw new KeyMissingError();
      }
      throw err;
    }
  } catch (_e) {
    // JSON.parse échoue ou format inconnu -> ne pas seed, renvoyer objet vide
    return {};
  }
}

/**
 * Chiffre et sauvegarde la configuration des modules dans users.modules.
 * - Entrée: objet JS quelconque (ex: { mood: {...}, goals: {...} })
 * - Chiffrement: AES-GCM (encryptAESGCM) -> { iv, data } en base64
 * - Persistance: JSON.stringify({ iv, data }) écrit dans users.modules
 */
export async function saveModulesConfig(pb, userId, mainKey, obj) {
  const plaintext = JSON.stringify(obj || {});
  const sealed = await encryptAESGCM(plaintext, mainKey); // => { iv, data }
  const payload = JSON.stringify(sealed);
  await pb.collection("users").update(userId, { modules: payload });
}

/** Lecteur pratique d'une entrée de config module (ou null si absente). */
export function getModuleEntry(cfg, moduleId) {
  return (cfg && cfg[moduleId]) || null;
}

/** Retourne une nouvelle config avec l'entrée module remplacée/ajoutée. */
export function setModuleEntry(cfg, moduleId, entry) {
  const next = { ...(cfg || {}) };
  next[moduleId] = entry;
  return next;
}
