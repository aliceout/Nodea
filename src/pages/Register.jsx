import React, { useState } from "react";
import { deriveKeyArgon2, encryptAESGCM } from "../services/webcrypto";
import pb from "../services/pocketbase";
import Layout from "../components/layout/LayoutMiddle";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import FormFeedback from "../components/common/FormError";

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
      // --- NOUVELLE LOGIQUE CHIFFREMENT ---

      // 1. Générer la clé principale aléatoire (32 bytes)
      const mainKeyRaw = window.crypto.getRandomValues(new Uint8Array(32));
      // 2. Générer un salt aléatoire (16 bytes, encodé en base64)
      const saltRaw = window.crypto.getRandomValues(new Uint8Array(16));
      const saltB64 = btoa(String.fromCharCode(...saltRaw));

      // 3. Dériver la clé de chiffrement à partir du mot de passe + salt
      const protectionKeyRaw = await deriveKeyArgon2(password, saltB64);

      // 4. Importer la clé dérivée dans WebCrypto
      const protectionKey = await window.crypto.subtle.importKey(
        "raw",
        protectionKeyRaw,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );

      // 5. Chiffrer la clé principale (on encode la clé principale en base64 pour la stocker comme texte)
      const encrypted = await encryptAESGCM(
        btoa(String.fromCharCode(...mainKeyRaw)),
        protectionKey
      );
      // encrypted = { iv, data } (base64 tous deux)

      // 6. Préparer l'objet utilisateur à envoyer
      const userObj = {
        username,
        email,
        password,
        passwordConfirm,
        role: "user",
        encrypted_key: JSON.stringify(encrypted), // {iv, data} en JSON
        encryption_salt: saltB64,
      };

      await pb.collection("users").create(userObj);

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
        <Input
          placeholder="Nom d'utilisateur"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Input
          placeholder="Code d’invitation"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          required
          className="mb-2"
        />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-2"
        />
        <Input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Confirme le mot de passe"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
          className="mb-2"
        />
        <FormFeedback message={error} type="error" className="mb-4 w-full" />
        <FormFeedback
          message={success}
          type="success"
          className="mb-4 w-full"
        />

        <Button type="submit" className="w-full">
          Créer le compte
        </Button>
      </form>
      <div className="mt-6 text-center w-full">
        <span className="text-gray-600">Déjà un compte ?</span>{" "}
        <a href="/login" className="text-nodea-sage underline hover:text-nodea-sage-dark">
          Se connecter
        </a>
      </div>
    </Layout>
  );
}
