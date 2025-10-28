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
import { createMainKeyMaterialFromBase64 } from "@/core/crypto/main-key";
import { useI18n } from "@/i18n/I18nProvider.jsx";

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
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== newPasswordConfirm) {
      setError(t("auth.changePassword.errors.passwordMismatch"));
      return;
    }

    if (!pb.authStore.isValid) {
      setError(t("auth.changePassword.errors.notAuthenticated"));
      return;
    }

    try {
      const user = pb.authStore.model;
      const salt = user.encryption_salt;

      if (!user?.encrypted_key) {
        setError(t("auth.changePassword.errors.missingEncryptedKey"));
        return;
      }

      let sealed;
      try {
        sealed = JSON.parse(user.encrypted_key);
      } catch {
        setError(t("auth.changePassword.errors.invalidEncryptedKey"));
        return;
      }

      const oldProtectionKey = await deriveKeyArgon2(oldPassword, salt);

      let decrypted;
      try {
        decrypted = await decryptAESGCM(sealed, oldProtectionKey);
      } catch {
        const legacyIv = maybeUnwrapDoubleBase64(sealed.iv);
        const legacyData = maybeUnwrapDoubleBase64(sealed.data);
        if (!legacyIv || !legacyData) {
          setError(t("auth.changePassword.errors.wrongOldPassword"));
          return;
        }
        try {
          decrypted = await decryptAESGCM(
            { iv: legacyIv, data: legacyData },
            oldProtectionKey
          );
        } catch {
          setError(t("auth.changePassword.errors.wrongOldPassword"));
          return;
        }
      }

      let normalizedMainKeyB64 = "";
      let workingMainKeyBytes = null;
      if (isProbablyBase64(decrypted)) {
        normalizedMainKeyB64 = decrypted;
        workingMainKeyBytes = base64ToBytes(decrypted);
      } else {
        workingMainKeyBytes = utf8ToBytes(decrypted);
        normalizedMainKeyB64 = bytesToBase64(workingMainKeyBytes);
      }

      if (!normalizedMainKeyB64) {
        setError(t("auth.changePassword.errors.missingMainKey"));
        return;
      }

      const newProtectionKey = await deriveKeyArgon2(newPassword, salt);
      const sealedForNewPassword = await encryptAESGCM(
        normalizedMainKeyB64,
        newProtectionKey
      );
      const newEncryptedKey = JSON.stringify(sealedForNewPassword);

      const updated = await pb.collection("users").update(user.id, {
        encrypted_key: newEncryptedKey,
        password: newPassword,
        passwordConfirm: newPassword,
        oldPassword: oldPassword,
      });

      if (updated) {
        pb.authStore.model = { ...pb.authStore.model, ...updated };
      }

      let mainKeyMaterial;
      try {
        mainKeyMaterial = await createMainKeyMaterialFromBase64(
          normalizedMainKeyB64
        );
      } catch (err) {
        console.error("[ChangePassword] rebuild mainKey material error", err);
        setError(t("auth.changePassword.errors.invalidMainKey"));
        return;
      } finally {
        if (workingMainKeyBytes instanceof Uint8Array) {
          workingMainKeyBytes.fill(0);
        }
      }

      dispatch({ type: "key/set", payload: mainKeyMaterial });
      setSuccess(t("auth.changePassword.success"));
    } catch (err) {
      const message = err?.message || err;
      setError(
        t("auth.changePassword.errors.generic", {
          values: { message },
        })
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
          <h1 className="text-2xl font-bold mb-6">
            {t("auth.changePassword.title")}
          </h1>

          <Input
            label={t("auth.changePassword.oldPasswordLabel")}
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            className="w-full mb-4"
            placeholder={t("auth.changePassword.oldPasswordPlaceholder")}
          />
          <Input
            label={t("auth.changePassword.newPasswordLabel")}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="w-full mb-4"
            placeholder={t("auth.changePassword.newPasswordPlaceholder")}
          />
          <Input
            label={t("auth.changePassword.confirmPasswordLabel")}
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            required
            className="w-full mb-6"
            placeholder={t("auth.changePassword.confirmPasswordPlaceholder")}
          />

          <FormFeedback message={error} type="error" className="w-full" />
          <FormFeedback message={success} type="success" className="w-full" />

          <Button
            type="submit"
            className="w-full bg-nodea-sage-dark hover:bg-nodea-sage-darker mt-2"
          >
            {t("auth.changePassword.submit")}
          </Button>
          <Button
            type="button"
            onClick={handleBackToAccount}
            className="w-full mt-3 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
          >
            {t("auth.changePassword.backToAccount")}
          </Button>
        </form>
      </div>
    </div>
  );
}
