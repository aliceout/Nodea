import React, { useState } from "react";
import pb from "../services/pocketbase";
import { useNavigate } from "react-router-dom";
import { useMainKey } from "../hooks/useMainKey";
import { deriveProtectionKey, decryptKey } from "../services/crypto";

import Layout from "../components/LayoutMiddle";
import LogoDaily from "../components/LogoDaily";

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

      // Dérive la clé de protection avec le mot de passe saisi + salt
      const protectionKey = deriveProtectionKey(password, salt);

      // Déchiffre la clé principale
      const mainKey = decryptKey(encryptedKey, protectionKey);

      if (!mainKey) {
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
        <LogoDaily className="mx-auto mb-6 w-44 h-16" />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 p-3 border rounded"
          required
        />
        {error && (
          <div className="text-red-500 mb-4 w-full text-center">{error}</div>
        )}
        <button
          type="submit"
          className="w-full bg-sky-600 text-white py-3 rounded hover:bg-sky-700 font-semibold"
        >
          Se connecter
        </button>
      </form>
      <div className="mt-6 text-center w-full">
        <span className="text-gray-600">Pas de compte ?</span>{" "}
        <a
          href="/register"
          className="text-sky-700 underline hover:text-sky-900"
        >
          Créer un compte
        </a>
      </div>
    </Layout>
  );
}
