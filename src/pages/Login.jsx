import React, { useState } from "react";
import pb from "../services/pocketbase";
import { useNavigate } from "react-router-dom";
import { useMainKey } from "../hooks/useMainKey";
import { deriveKeyArgon2, decryptAESGCM } from "../services/webcrypto";
import Layout from "../components/layout/LayoutMiddle";
import NodeaLongLogo from "../components/common/NodeaLongLogo.jsx";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import FormError from "../components/common/FormError";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { setMainKey } = useMainKey();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await pb.collection("users").authWithPassword(email, password);

      const user = pb.authStore.model;
      const encryptedKey = user.encrypted_key;
      const salt = user.encryption_salt;

      // 1. Dérive la clé de protection avec Argon2id
      const protectionKeyRaw = await deriveKeyArgon2(password, salt);

      // 2. Importe la clé pour WebCrypto
      const protectionKey = await window.crypto.subtle.importKey(
        "raw",
        protectionKeyRaw,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );

      // 3. Déchiffre la clé principale
      let mainKey;
      try {
        const encryptedObj = JSON.parse(encryptedKey); // {iv, data}
        const mainKeyB64 = await decryptAESGCM(encryptedObj, protectionKey);
        // Décoder la clé principale (base64 -> Uint8Array)
        const mainKeyRaw = new Uint8Array(
          atob(mainKeyB64)
            .split("")
            .map((c) => c.charCodeAt(0))
        );
        mainKey = mainKeyRaw;
      } catch (e) {
        setError(
          "Erreur de déchiffrement de la clé (mot de passe incorrect ou données corrompues)"
        );
        return;
      }

      setMainKey(mainKey);
      navigate("/journal");
    } catch (err) {
      setError("Identifiants invalides");
    }
  };

  return (
    <Layout>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
      >
        <NodeaLongLogo className="mx-auto mb-3 w-1/2" />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <Input
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          required
        />
        <Button type="submit">Se connecter</Button>
        {error && <FormError message={error} />}
      </form>
      <div className="mt-6 text-center w-full">
        <span className="text-gray-600">Pas de compte ?</span>{" "}
        <a
          href="/register"
          className="text-nodea-sage underline hover:text-nodea-sage-dark"
        >
          Créer un compte
        </a>
      </div>
    </Layout>
  );
}
