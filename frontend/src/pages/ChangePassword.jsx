import React, { useState } from "react";
import pb from "../services/pocketbase";
import { useStore } from "@/store/StoreProvider";
import {
  deriveKeyArgon2,
  encryptAESGCM,
  decryptAESGCM,
} from "@/services/crypto/webcrypto";

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { dispatch } = useStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== newPasswordConfirm) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    if (!pb.authStore.isValid) {
      setError("Vous devez être connecté·e.");
      return;
    }

    try {
      const user = pb.authStore.model;
      const encryptedKey = JSON.parse(user.encrypted_key);
      const salt = user.encryption_salt;

      // Dérive la clé brute depuis l'ancien mot de passe
      const oldProtectionKey = await deriveKeyArgon2(oldPassword, salt);

      // Importe la clé brute en CryptoKey WebCrypto pour déchiffrement
      const oldCryptoKey = await window.crypto.subtle.importKey(
        "raw",
        oldProtectionKey,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      // Déchiffre la clé principale avec l'ancienne clé
      let decryptedMainKey;
      try {
        decryptedMainKey = await decryptAESGCM(encryptedKey, oldCryptoKey);
      } catch (err) {
        setError("Ancien mot de passe incorrect.");
        return;
      }

      // Dérive la clé brute depuis le nouveau mot de passe
      const newProtectionKey = await deriveKeyArgon2(newPassword, salt);

      // Importe la nouvelle clé brute en CryptoKey WebCrypto pour chiffrement
      const newCryptoKey = await window.crypto.subtle.importKey(
        "raw",
        newProtectionKey,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
      );

      // Rechiffre la clé principale avec la nouvelle clé
      const newEncryptedKey = JSON.stringify(
        await encryptAESGCM(decryptedMainKey, newCryptoKey)
      );

      // Mets à jour PocketBase
      await pb.collection("users").update(user.id, {
        encrypted_key: newEncryptedKey,
        password: newPassword,
        passwordConfirm: newPassword,
        oldPassword: oldPassword,
      });

      dispatch({ type: "key/set", payload: decryptedMainKey });
      setSuccess("Mot de passe changé avec succès.");
      // Optionnel : rediriger après succès
      // navigate("/journal");
    } catch (err) {
      setError(
        "Erreur lors du changement de mot de passe : " + (err.message || err)
      );
    }
  };

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="w-full min-h-screen flex flex-col justify-center items-center">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
        >
          <h1 className="text-2xl font-bold mb-6">Changer de mot de passe</h1>

          <input
            type="password"
            placeholder="Ancien mot de passe"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full mb-4 p-3 border rounded"
            required
          />
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full mb-4 p-3 border rounded"
            required
          />
          <input
            type="password"
            placeholder="Confirmez le nouveau mot de passe"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            className="w-full mb-6 p-3 border rounded"
            required
          />

          {error && (
            <div className="text-red-500 mb-4 w-full text-center">{error}</div>
          )}
          {success && (
            <div className="text-green-600 mb-4 w-full text-center">
              {success}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-sky-600 text-white py-3 rounded hover:bg-sky-700 font-semibold"
          >
            Valider
          </button>
        </form>
      </div>
    </div>
  );
}
