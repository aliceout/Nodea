// Wrapper de déchiffrement avec retry et gestion d'erreurs crypto
// Brief : Nodea / key missing spec

import { decryptAESGCM } from "./webcrypto";
import { useStore } from "@/store/StoreProvider";

export class KeyMissingError extends Error {
  constructor(message = "Clé de chiffrement manquante ou invalide") {
    super(message);
    this.name = "KeyMissingError";
  }
}

// Classification des erreurs WebCrypto
function isCryptoError(err) {
  // WebCrypto : DataError, OperationError, InvalidAccessError, etc.
  // On cible DataError et OperationError pour la perte de clé
  return (
    err &&
    (err.name === "DataError" ||
      err.name === "OperationError" ||
      err.name === "InvalidAccessError" ||
      err.message?.includes("key") ||
      err.message?.includes("CryptoKey"))
  );
}

/**
 * Déchiffre avec retry 1x sur erreur crypto, sinon jette immédiatement
 * @param {Object} args - { encrypted, key }
 * @returns {Promise<string>} - Données déchiffrées
 * @throws {KeyMissingError} si la clé est absente ou invalide
 */
export async function decryptWithRetry({ encrypted, key, markMissing }) {
  try {
    return await decryptAESGCM(encrypted, key);
  } catch (err) {
    if (isCryptoError(err)) {
      // Log dev
      if (process.env.NODE_ENV === "development") {
        console.warn("CRYPTO:retry", err);
      }
      // Retry une fois
      try {
        return await decryptAESGCM(encrypted, key);
      } catch (err2) {
        if (isCryptoError(err2)) {
          if (typeof markMissing === "function") markMissing();
          throw new KeyMissingError();
        }
        throw err2;
      }
    }
    throw err;
  }
}
