import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/core/store/StoreProvider";
import { setTab } from "@/core/store/actions";
import pb from "@/core/api/pocketbase";
import { deriveKeyArgon2, decryptAESGCM } from "@/core/crypto/webcrypto";
import { clearGuardsCache } from "@/core/crypto/guards";
import { createMainKeyMaterialFromBase64 } from "@/core/crypto/main-key";
import Logo from "@ui/branding/LogoLong.jsx";
import Button from "@/ui/atoms/base/Button";
import Input from "@/ui/atoms/form/Input";
import FormError from "@/ui/atoms/form/FormError";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { dispatch } = useStore();
  const navigate = useNavigate();

  const clearAuthAndAbort = (message) => {
    try {
      pb.authStore?.clear?.();
    } catch (err) {
      console.warn("[Login] failed to clear auth store", err);
    }
    clearGuardsCache();
    dispatch({ type: "key/set", payload: null });
    dispatch({ type: "key/status", payload: "missing" });
    setError(message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await pb.collection("users").authWithPassword(email, password);
      const user = pb.authStore.model;
      const salt =
        user?.encryption_salt ?? user?.profile?.salt ?? user?.salt ?? "";
      if (!salt) {
        setError("Aucun 'salt' sur le profil utilisateur.");
        return;
      }
      const protectionKeyBytes = await deriveKeyArgon2(password, salt);

      let sealed;
      try {
        sealed = JSON.parse(user?.encrypted_key || "");
      } catch {
        clearAuthAndAbort(
          "ClÃ© chiffrÃ©e invalide sur le profil utilisateur. Reconnectez-vous."
        );
        return;
      }
      if (!sealed?.iv || !sealed?.data) {
        clearAuthAndAbort(
          "ClÃ© chiffrÃ©e manquante sur le profil utilisateur. Reconnectez-vous."
        );
        return;
      }

      let mainKeyPlain;
      try {
        mainKeyPlain = await decryptAESGCM(sealed, protectionKeyBytes);
      } catch (err) {
        console.error("[Login] decrypt mainKey error", err);
        clearAuthAndAbort(
          "Impossible de dÃ©chiffrer la clÃ© de chiffrement. Reconnectez-vous."
        );
        return;
      }

      let mainKeyMaterial;
      try {
        mainKeyMaterial = await createMainKeyMaterialFromBase64(mainKeyPlain);
      } catch (err) {
        console.error("[Login] build mainKey material error", err);
        clearAuthAndAbort(
          "ClÃ© de chiffrement corrompue. Reconnectez-vous."
        );
        return;
      }

      dispatch({ type: "key/set", payload: mainKeyMaterial });
      dispatch({ type: "key/status", payload: "ready" });
      clearGuardsCache();
      dispatch(setTab("home"));
      navigate("/", { replace: true });
    } catch (err) {
      setError("Identifiants invalides");
    }
  };

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="w-full min-h-screen flex flex-col justify-center items-center">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 items-center w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
        >
          <Logo className="mx-auto mb-3 w-1/2" />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full"
          />
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            required
            className="w-full"
          />
          <Button
            type="submit"
            className=" bg-nodea-sage-dark hover:bg-nodea-sage-darker mt-4"
          >
            Se connecter
          </Button>
          {error && <FormError message={error} />}
        </form>
        <div className="mt-6 text-center w-full flex flex-col justify-center">
          <span className="text-gray-600">Pas de compteâ€¯?</span>{" "}
          <a
            href="/register"
            className="text-nodea-sage underline hover:text-nodea-sage-dark"
          >
            CrÃ©er un compte
          </a>
        </div>
      </div>
    </div>
  );
}


