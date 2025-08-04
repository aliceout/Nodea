import React, { useState } from "react";
import {
  generateRandomKey,
  generateSalt,
  deriveProtectionKey,
  encryptKey,
} from "../services/crypto";
import pb from "../services/pocketbase";
import Layout from "../components/LayoutMiddle";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== passwordConfirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    // 1. Vérification du code d'invitation
    try {
      const codeResult = await pb.collection("invites_codes").getFullList({
        filter: `code="${inviteCode}"`,
      });
      if (!codeResult.length) {
        setError("Code d’invitation invalide ou déjà utilisé");
        return;
      }
    } catch (err) {
      setError("Erreur lors de la vérification du code");
      return;
    }

    // 2. Création du compte + suppression du code
    try {
      // 1. Clé principale de chiffrement (unique par user)
      const mainKey = generateRandomKey(32);

      // 2. Salt unique (pour la dérivation PBKDF2)
      const salt = generateSalt(16);

      // 3. Dérivation d'une clé de protection à partir du password et du salt
      const protectionKey = deriveProtectionKey(password, salt);

      // 4. Chiffre la clé principale avec la clé dérivée
      const encrypted_key = encryptKey(mainKey, protectionKey);
      const encryption_salt = salt;
      await pb.collection("users").create({
        username,
        email,
        password,
        passwordConfirm,
        role: "user",
        encrypted_key,
        encryption_salt,
      });

      // Suppression du code d'invitation après usage
      try {
        const codeRecord = await pb
          .collection("invites_codes")
          .getFirstListItem(`code="${inviteCode}"`);
        if (codeRecord && codeRecord.id) {
          await pb.collection("invites_codes").delete(codeRecord.id);
        }
      } catch (e) {
        // On log, mais on n'affiche rien à l'utilisateur·ice
        console.warn("Erreur suppression code invitation :", e);
      }

      setSuccess("Utilisateur créé avec succès");
      setUsername("");
      setInviteCode("");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
    } catch (err) {
      setError("Erreur lors de la création du compte");
    }
  };

  return (
    <Layout>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
      >
        <h1 className="text-2xl font-bold mb-6 text-center w-full">
          Créer un compte
        </h1>
        <input
          type="text"
          placeholder="Nom d'utilisateur"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
          required
        />
        <input
          type="text"
          placeholder="Code d’invitation"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="w-full mb-4 p-3 border rounded"
          required
        />
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
          className="w-full mb-4 p-3 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Confirme le mot de passe"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
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
          Créer le compte
        </button>
      </form>
      <div className="mt-6 text-center w-full">
        <span className="text-gray-600">Déjà un compte ?</span>{" "}
        <a href="/login" className="text-sky-700 underline hover:text-sky-900">
          Se connecter
        </a>
      </div>
    </Layout>
  );
}
