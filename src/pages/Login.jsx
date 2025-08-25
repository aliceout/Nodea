import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/StoreProvider";
import { setTab } from "@/store/actions";
import pb from "@/services/pocketbase";
import { useMainKey } from "@/hooks/useMainKey";
import { deriveKeyArgon2 } from "@/services/webcrypto";
import Logo from "../components/common/LogoLong.jsx";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import FormError from "../components/common/FormError";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { setMainKey } = useMainKey();
  const navigate = useNavigate();
  const store = useStore();
  const dispatch = store?.dispatch ?? store?.[1];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // 1) Auth PocketBase
      await pb.collection("users").authWithPassword(email, password);

      // 2) Récupération du user et du salt (mêmes champs qu'avant)
      const user = pb.authStore.model;
      const salt =
        user?.encryption_salt ?? user?.profile?.salt ?? user?.salt ?? "";

      if (!salt) {
        setError("Aucun 'salt' sur le profil utilisateur.");
        return;
      }

      // 3) Dérivation Argon2id -> Uint8Array(32)
      const mainKeyBytes = await deriveKeyArgon2(password, salt);

      // 4) Place la clé brute (32 octets) dans le contexte (mémoire uniquement)
      setMainKey(mainKeyBytes);

      // 5) Navigate
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
          className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
        >
          <Logo className="mx-auto mb-3 w-1/2" />
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
      </div>
    </div>
  );
}
