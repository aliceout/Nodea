import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/core/store/StoreProvider";
import { setTab } from "@/core/store/actions";
import pb from "@/core/api/pocketbase";
import {
  deriveKeyArgon2,
  decryptAESGCM,
  base64ToBytes,
} from "@/core/crypto/webcrypto";
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
        setError("Clé chiffrée invalide sur le profil utilisateur.");
        return;
      }
      if (!sealed?.iv || !sealed?.data) {
        setError("Clé chiffrée manquante sur le profil utilisateur.");
        return;
      }

      let mainKeyPlain;
      try {
        mainKeyPlain = await decryptAESGCM(sealed, protectionKeyBytes);
      } catch (err) {
        console.error("[Login] decrypt mainKey error", err);
        setError("Impossible de déchiffrer la clé de chiffrement.");
        return;
      }

      let mainKeyBytes;
      try {
        mainKeyBytes = base64ToBytes(mainKeyPlain);
      } catch (err) {
        console.error("[Login] decode mainKey error", err);
        setError("Clé de chiffrement corrompue.");
        return;
      }

      dispatch({ type: "key/set", payload: mainKeyBytes });
      dispatch({ type: "key/status", payload: "ready" });
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
          <span className="text-gray-600">Pas de compte ?</span>{" "}
          <a
            href="/register"
            className="text-nodea-sage underline hover:text-nodea-sage-dark"
          >
            Créer un compte
          </a>
        </div>
      </div>
    </div>
  );
}
