import React, { useState } from "react";
import pb from "../services/pocketbase";
import { useNavigate } from "react-router-dom";
import { useMainKey } from "../hooks/useMainKey";
import {
  deriveProtectionKey,
  decryptKey,
  encryptKey,
} from "../services/crypto";

import Layout from "../components/LayoutMiddle";

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { mainKey, setMainKey } = useMainKey();
  const navigate = useNavigate();

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
      const encryptedKey = user.encrypted_key;
      const salt = user.encryption_salt;

      // Dérive la clé protection avec l'ancien mot de passe
      const oldProtectionKey = deriveProtectionKey(oldPassword, salt);

      // Déchiffre la clé principale avec l'ancien mot de passe
      const decryptedMainKey = decryptKey(encryptedKey, oldProtectionKey);

      if (!decryptedMainKey) {
        setError("Ancien mot de passe incorrect.");
        return;
      }

      // Dérive la clé protection avec le nouveau mot de passe
      const newProtectionKey = deriveProtectionKey(newPassword, salt);

      // Rechiffre la clé principale avec la nouvelle clé protection
      const newEncryptedKey = encryptKey(decryptedMainKey, newProtectionKey);

      // Mets à jour la clé chiffrée, le mot de passe et l'ancien mot de passe dans PocketBase
      await pb.collection("users").update(user.id, {
        encrypted_key: newEncryptedKey,
        password: newPassword,
        passwordConfirm: newPassword,
        oldPassword: oldPassword, // <-- ajout ici pour satisfaire la validation serveur
      });

      // Mets à jour la clé principale dans le contexte
      setMainKey(decryptedMainKey);

      setSuccess("Mot de passe changé avec succès.");
      // Optionnel : rediriger vers journal ou page d’accueil
      // navigate("/journal");
    } catch (err) {
      setError("Erreur lors du changement de mot de passe : " + err.message);
    }
  };

  return (
    <Layout>
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
    </Layout>
  );
}
