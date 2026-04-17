/**
 * Helpers to load and persist encrypted user preference blobs stored on the PocketBase user record.
 * Preferences are transparently decrypted/encrypted with the caller provided main key.
 */
import { encryptAESGCM, decryptAESGCM, KeyMissingError } from "@/core/crypto/webcrypto";

/**
 * Normalise a URL-safe Base64 string to the canonical Base64 alphabet.
 *
 * @param {string} value - Possibly URL-safe Base64 value.
 * @returns {string} Normalised Base64 with padding.
 */
function normalizeBase64(value) {
  if (typeof value !== "string") return value;
  let output = value.replaceAll("-", "+").replaceAll("_", "/");
  while (output.length % 4) output += "=";
  return output;
}

/**
 * Fetch the user preference payload from PocketBase and decrypt it when needed.
 *
 * @param {import("pocketbase").default} pb - Shared PocketBase client.
 * @param {string} userId - PocketBase user identifier.
 * @param {CryptoKey} mainKey - Symmetric key used to decrypt the sealed payload.
 * @returns {Promise<Record<string, any>>} Parsed preference object (empty object when missing).
 * @throws {KeyMissingError} When the provided key cannot decrypt the payload.
 */
export async function loadUserPreferences(pb, userId, mainKey) {
  const user = await pb.collection("users").getOne(userId);
  const raw = user?.preferences || null;
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    const looksPlain =
      parsed &&
      typeof parsed === "object" &&
      !("iv" in parsed) &&
      !("data" in parsed) &&
      !("cipher" in parsed);
    if (looksPlain) {
      return parsed;
    }

    const sealed = {
      iv: normalizeBase64(parsed?.iv || ""),
      data: normalizeBase64(parsed?.data || parsed?.cipher || ""),
    };
    if (!sealed.iv || !sealed.data) return {};

    try {
      const plaintext = await decryptAESGCM(sealed, mainKey);
      return JSON.parse(plaintext || "{}");
    } catch (error) {
      if (
        error instanceof KeyMissingError ||
        error?.name === "DataError" ||
        error?.name === "OperationError" ||
        error?.name === "InvalidAccessError" ||
        error?.message?.toLowerCase?.().includes("key")
      ) {
        throw new KeyMissingError();
      }
      throw error;
    }
  } catch {
    return {};
  }
}

/**
 * Encrypt and persist the provided preference object on the user record.
 *
 * @param {import("pocketbase").default} pb - Shared PocketBase client.
 * @param {string} userId - PocketBase user identifier.
 * @param {CryptoKey} mainKey - Symmetric key used to encrypt the payload.
 * @param {Record<string, any>} preferences - Preference object to store.
 * @returns {Promise<import("pocketbase").RecordModel>} The updated user record.
 */
export async function saveUserPreferences(pb, userId, mainKey, preferences) {
  const plaintext = JSON.stringify(preferences || {});
  const sealed = await encryptAESGCM(plaintext, mainKey);
  const payload = JSON.stringify(sealed);
  const updated = await pb
    .collection("users")
    .update(userId, { preferences: payload });

  const token = pb?.authStore?.token ?? null;
  const currentModel = pb?.authStore?.model ?? null;
  if (token && currentModel) {
    pb.authStore.save(token, { ...currentModel, preferences: payload });
  }

  return updated;
}
