import { encryptAESGCM, decryptAESGCM, KeyMissingError } from "@/core/crypto/webcrypto";

function normalizeBase64(value) {
  if (typeof value !== "string") return value;
  let output = value.replaceAll("-", "+").replaceAll("_", "/");
  while (output.length % 4) output += "=";
  return output;
}

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

export async function saveUserPreferences(pb, userId, mainKey, preferences) {
  const plaintext = JSON.stringify(preferences || {});
  const sealed = await encryptAESGCM(plaintext, mainKey);
  const payload = JSON.stringify(sealed);
  const updated = await pb
    .collection("users")
    .update(userId, { preferences: payload });

  if (pb?.authStore?.model) {
    pb.authStore.model = { ...pb.authStore.model, preferences: payload };
  }

  return updated;
}

