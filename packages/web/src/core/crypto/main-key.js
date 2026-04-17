import { base64ToBytes, bytesToBase64, importAesKeyFromBytes } from "./webcrypto";

const MAIN_KEY_LENGTH = 32;

const textEncoder = new TextEncoder();

function isUint8Array(value) {
  return value instanceof Uint8Array;
}

export function hasMainKeyMaterial(value) {
  if (!value) return false;
  if (value.type === "secret" && value.algorithm?.name) return true;
  if (typeof value === "string") {
    try {
      return base64ToBytes(value).length === MAIN_KEY_LENGTH;
    } catch {
      return false;
    }
  }
  if (isUint8Array(value)) return value.length === MAIN_KEY_LENGTH;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.base64 === "string" &&
    value.base64.length > 0 &&
    !!value.aesKey &&
    !!value.hmacKey
  );
}

export function getMainKeyBase64(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.base64) return value.base64;
  if (isUint8Array(value) && value.length === MAIN_KEY_LENGTH) {
    return bytesToBase64(value);
  }
  return "";
}

export function getMainKeyBytes(value) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const bytes = base64ToBytes(value);
      return bytes.length === MAIN_KEY_LENGTH ? bytes : null;
    } catch {
      return null;
    }
  }
  if (isUint8Array(value)) {
    return value.length === MAIN_KEY_LENGTH ? value : null;
  }
  if (value?.base64) {
    const bytes = base64ToBytes(value.base64);
    return bytes.length === MAIN_KEY_LENGTH ? bytes : null;
  }
  if (value?.buffer instanceof ArrayBuffer) {
    const bytes = new Uint8Array(value.buffer);
    return bytes.length === MAIN_KEY_LENGTH ? bytes : null;
  }
  return null;
}

export async function ensureAesKey(value) {
  if (!value) throw new Error("Cle principale absente.");
  if (value.type === "secret" && value.algorithm?.name === "AES-GCM") {
    return value;
  }
  if (value.aesKey) return value.aesKey;
  const bytes = getMainKeyBytes(value);
  if (!bytes) {
    throw new Error("Format de cle principale inconnu pour AES.");
  }
  try {
    return await importAesKeyFromBytes(bytes);
  } finally {
    if (value?.base64) bytes.fill(0);
  }
}

export async function ensureHmacKey(value) {
  if (!value) throw new Error("Cle principale absente.");
  if (value.type === "secret" && value.algorithm?.name === "HMAC") {
    return value;
  }
  if (value.hmacKey) return value.hmacKey;
  const bytes = getMainKeyBytes(value);
  if (!bytes) {
    throw new Error("Format de cle principale inconnu pour HMAC.");
  }
  try {
    return await window.crypto.subtle.importKey(
      "raw",
      bytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
  } finally {
    if (value?.base64) bytes.fill(0);
  }
}

export async function createMainKeyMaterialFromBase64(base64Key) {
  if (!base64Key || typeof base64Key !== "string") {
    throw new Error("Cle principale invalide (base64).");
  }
  const bytes = base64ToBytes(base64Key);
  if (bytes.length !== MAIN_KEY_LENGTH) {
    throw new Error("Taille de cle principale inattendue.");
  }
  try {
    const [aesKey, hmacKey] = await Promise.all([
      importAesKeyFromBytes(bytes),
      window.crypto.subtle.importKey(
        "raw",
        bytes,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      ),
    ]);

    return {
      base64: base64Key,
      aesKey,
      hmacKey,
    };
  } finally {
    bytes.fill(0);
  }
}

export function wipeMainKeyMaterial(material) {
  if (!material) return;
  if (typeof material === "string") return;
  if (isUint8Array(material)) {
    material.fill(0);
    return;
  }
  if (typeof material === "object") {
    if (typeof material.base64 === "string") material.base64 = "";
    if (material.aesKey?.usages?.length) {
      try {
        window.crypto.subtle.digest("SHA-256", textEncoder.encode(""));
      } catch {
        // ignore
      }
    }
    if (material.hmacKey?.usages?.length) {
      try {
        window.crypto.subtle.digest("SHA-256", textEncoder.encode(""));
      } catch {
        // ignore
      }
    }
  }
}
