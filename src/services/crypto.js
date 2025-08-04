import CryptoJS from "crypto-js";

// Génère une clé aléatoire (clé principale AES, 32 bytes => 256 bits)
export function generateRandomKey(len = 32) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < len; i++) {
    key += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return key;
}

// Génère un salt (pour PBKDF2)
export function generateSalt(len = 16) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let salt = "";
  for (let i = 0; i < len; i++) {
    salt += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return salt;
}

// Dérive une clé de protection depuis le mot de passe et le salt (pour chiffrer la clé principale)
export function deriveProtectionKey(password, salt) {
  return CryptoJS.PBKDF2(password, salt, { keySize: 256 / 32 }).toString();
}

// Chiffre la clé principale avec la clé dérivée
export function encryptKey(mainKey, protectionKey) {
  return CryptoJS.AES.encrypt(mainKey, protectionKey).toString();
}

// Déchiffre la clé principale avec la clé dérivée
export function decryptKey(encryptedKey, protectionKey) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, protectionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return null;
  }
}
