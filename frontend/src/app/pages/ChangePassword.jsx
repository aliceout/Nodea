import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import pb from "@/core/api/pocketbase";
import { useStore } from "@/core/store/StoreProvider";
import { setTab } from "@/core/store/actions";
import Input from "@/ui/atoms/form/Input";
import Button from "@/ui/atoms/base/Button";
import FormFeedback from "@/ui/atoms/form/FormError";
import {
  deriveKeyArgon2,
  encryptAESGCM,
  decryptAESGCM,
  base64ToBytes,
  bytesToBase64,
} from "@/core/crypto/webcrypto";

const BASE64_REGEX = /^[A-Za-z0-9+/=]+$/;

function isProbablyBase64(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length % 4 === 0 &&
    BASE64_REGEX.test(value)
  );
}

function maybeUnwrapDoubleBase64(value) {
  if (typeof value !== "string") return null;
  try {
    const ascii = atob(value);
    return isProbablyBase64(ascii) ? ascii : null;
  } catch {
    return null;
  }
}

function utf8ToBytes(str) {
  return new TextEncoder().encode(str || "");
}

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { dispatch, mainKey: cachedMainKey } = useStore();
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
      const salt = user.encryption_salt;

      let effectiveMainKeyBytes =
        cachedMainKey instanceof Uint8Array ? cachedMainKey : null;

      if (!effectiveMainKeyBytes) {
        const encryptedKeyRaw = user?.encrypted_key;
        if (!encryptedKeyRaw) {
          setError(
            "Clé principale introuvable dans votre profil. Reconnectez-vous puis réessayez."
          );
          return;
        }

        let encryptedKey;
        try {
          encryptedKey = JSON.parse(encryptedKeyRaw);
        } catch {
          setError("Format de clé chiffrée invalide.");
          return;
        }

        const oldProtectionKey = await deriveKeyArgon2(oldPassword, salt);
        const oldCryptoKey = await window.crypto.subtle.importKey(
          "raw",
          oldProtectionKey,
          { name: "AES-GCM" },
          false,
          ["decrypt"]
        );

        let decrypted;
        try {
          decrypted = await decryptAESGCM(encryptedKey, oldCryptoKey);
        } catch {
          const legacyIv = maybeUnwrapDoubleBase64(encryptedKey.iv);
          const legacyData = maybeUnwrapDoubleBase64(encryptedKey.data);

          if (!legacyIv || !legacyData) {
            setError("Ancien mot de passe incorrect.");
            return;
          }

          try {
            decrypted = await decryptAESGCM(
              { iv: legacyIv, data: legacyData },
              oldCryptoKey
            );
          } catch {
            setError("Ancien mot de passe incorrect.");
            return;
          }
        }

        effectiveMainKeyBytes = isProbablyBase64(decrypted)
          ? base64ToBytes(decrypted)
          : utf8ToBytes(decrypted);
      }

      if (!effectiveMainKeyBytes) {
        setError(
          "Impossible de récupérer votre clé de chiffrement. Reconnectez-vous puis réessayez."
        );
        return;
      }

      const normalizedMainKeyB64 = bytesToBase64(effectiveMainKeyBytes);

      const newProtectionKey = await deriveKeyArgon2(newPassword, salt);
      const newCryptoKey = await window.crypto.subtle.importKey(
        "raw",
        newProtectionKey,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
      );

      const newEncryptedKey = JSON.stringify(
        await encryptAESGCM(normalizedMainKeyB64, newCryptoKey)
      );

      await pb.collection("users").update(user.id, {
        encrypted_key: newEncryptedKey,
        password: newPassword,
        passwordConfirm: newPassword,
        oldPassword: oldPassword,
      });

      dispatch({ type: "key/set", payload: effectiveMainKeyBytes });
      setSuccess("Mot de passe changé avec succès.");
    } catch (err) {
      setError(
        "Erreur lors du changement de mot de passe : " + (err.message || err)
      );
    }
  };

  const handleBackToAccount = () => {
    dispatch(setTab("account"));
    navigate("/flow", { replace: true });
  };

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="w-full min-h-screen flex flex-col justify-center items-center">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
        >
          <h1 className="text-2xl font-bold mb-6">Changer de mot de passe</h1>

          <Input
            label="Ancien mot de passe"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            className="w-full mb-4"
            placeholder="Ancien mot de passe"
          />
          <Input
            label="Nouveau mot de passe"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="w-full mb-4"
            placeholder="Nouveau mot de passe"
          />
          <Input
            label="Confirmez le nouveau mot de passe"
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            required
            className="w-full mb-6"
            placeholder="Confirmez le nouveau mot de passe"
          />

          <FormFeedback message={error} type="error" className="w-full" />
          <FormFeedback message={success} type="success" className="w-full" />

          <Button
            type="submit"
            className="w-full bg-nodea-sage-dark hover:bg-nodea-sage-darker mt-2"
          >
            Valider
          </Button>
          <Button
            type="button"
            onClick={handleBackToAccount}
            className="w-full mt-3 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
          >
            Retourner à mon compte
          </Button>
        </form>
      </div>
    </div>
  );
}
