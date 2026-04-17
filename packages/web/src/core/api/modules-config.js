/**
 * Helpers to load and persist the encrypted module configuration stored on `users.modules`.
 * Each entry tracks whether a module is enabled together with its module_user_id / guard metadata.
 *
 * Stored shape example:
 * ```
 * {
 *   "mood":  { "enabled": true,  "module_user_id": "g_xxx", "guard": "g_...", "algo": "v1" },
 *   "goals": { "enabled": false, "module_user_id": null,     "guard": null,  "algo": "v1" }
 * }
 * ```
 */
import {
  encryptAESGCM,
  decryptAESGCM,
  KeyMissingError,
} from "@/core/crypto/webcrypto";

/**
 * Load and decrypt the module configuration stored on the user record.
 * Accepts both legacy plaintext payloads and AES-GCM sealed structures.
 *
 * @param {import("pocketbase").default} pb - Shared PocketBase client.
 * @param {string} userId - PocketBase user identifier.
 * @param {CryptoKey | Uint8Array} mainKey - Symmetric key used to decrypt the payload.
 * @returns {Promise<Record<string, any>>} Normalised configuration object (empty object on absence).
 * @throws {KeyMissingError} When the provided key cannot decrypt the payload.
 */
export async function loadModulesConfig(pb, userId, mainKey) {
  const user = await pb.collection("users").getOne(userId);
  const raw = user.modules || null;
  if (!raw) return {};

  const toStdB64 = (value) => {
    if (typeof value !== "string") return value;
    let output = value.replaceAll("-", "+").replaceAll("_", "/");
    while (output.length % 4) output += "=";
    return output;
  };

  try {
    const parsed = JSON.parse(raw);

    const keys = parsed && typeof parsed === "object" ? Object.keys(parsed) : [];
    const looksPlain =
      parsed &&
      typeof parsed === "object" &&
      !("iv" in parsed) &&
      !("data" in parsed) &&
      !("cipher" in parsed) &&
      keys.length > 0 &&
      keys.some(
        (key) =>
          parsed?.[key] &&
          typeof parsed[key] === "object" &&
          ("enabled" in parsed[key] || "module_user_id" in parsed[key])
      );
    if (looksPlain) return parsed;

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
            Object.entries(obj || {}).map(([key, value]) => [
              key,
              {
                enabled: !!value?.enabled,
                module_user_id: value?.module_user_id || null,
              },
            ])
          );
          console.log("[ModulesConfig] Loaded (DEV)", summary);
        } catch {
          // noop – summary logging is best-effort for dev diagnostics
        }
      }
      return obj;
    } catch (error) {
      const cryptoFailure =
        error &&
        (error.name === "DataError" ||
          error.name === "OperationError" ||
          error.name === "InvalidAccessError" ||
          error.message?.toLowerCase?.().includes("key") ||
          error.message?.toLowerCase?.().includes("crypto"));
      if (cryptoFailure) {
        throw new KeyMissingError();
      }
      throw error;
    }
  } catch {
    return {};
  }
}

/**
 * Encrypt and persist the configuration object on the user record.
 *
 * @param {import("pocketbase").default} pb - Shared PocketBase client.
 * @param {string} userId - PocketBase user identifier.
 * @param {CryptoKey | Uint8Array} mainKey - Symmetric key used to encrypt the config.
 * @param {Record<string, any>} obj - Configuration object to serialise.
 * @returns {Promise<void>}
 */
export async function saveModulesConfig(pb, userId, mainKey, obj) {
  const plaintext = JSON.stringify(obj || {});
  const sealed = await encryptAESGCM(plaintext, mainKey);
  const payload = JSON.stringify(sealed);
  await pb.collection("users").update(userId, { modules: payload });
}

/**
 * Convenience accessor that returns a module entry or null when missing.
 *
 * @param {Record<string, any>} cfg - Module configuration object.
 * @param {string} moduleId - Module key (e.g. "mood").
 * @returns {Record<string, any> | null}
 */
export function getModuleEntry(cfg, moduleId) {
  return (cfg && cfg[moduleId]) || null;
}

/**
 * Produce a new configuration object with the provided module entry updated.
 *
 * @param {Record<string, any>} cfg - Existing configuration object.
 * @param {string} moduleId - Module key (e.g. "mood").
 * @param {Record<string, any>} entry - Module configuration to store.
 * @returns {Record<string, any>} New configuration object.
 */
export function setModuleEntry(cfg, moduleId, entry) {
  const next = { ...(cfg || {}) };
  next[moduleId] = entry;
  return next;
}
