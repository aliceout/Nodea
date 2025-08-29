import React, { useState } from "react";
import { deriveKeyArgon2, encryptAESGCM } from "@/services/webcrypto";
import pb from "@/services/pocketbase";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import FormFeedback from "@/components/common/FormError";

// Utils base64 <-> Uint8Array (sans changer tes styles)
function toB64(u8) {
  return btoa(String.fromCharCode(...u8));
}
function fromB64(b64) {
  return new Uint8Array(
    atob(b64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
}

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

    // 1) Vérification du code d'invitation
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

    // 2) Création du compte (nouvelle logique crypto alignée)
    try {
      // (a) Génère la clé principale (Uint8Array(32))
      const mainKeyRaw = window.crypto.getRandomValues(new Uint8Array(32));

      // (b) Génère le salt (Uint8Array(16)) et encode en base64 pour la DB
      const saltRaw = window.crypto.getRandomValues(new Uint8Array(16));
      const saltB64 = toB64(saltRaw);

      // (c) Dérive la clé de protection (Uint8Array(32)) depuis password+salt
      const protectionKeyBytes32 = await deriveKeyArgon2(password, saltB64); // retourne Uint8Array(32)

      // (d) Chiffre la clé principale brute avec AES-GCM en passant la clé dérivée **bytes**
      const encrypted = await encryptAESGCM(mainKeyRaw, protectionKeyBytes32); // {iv: Uint8Array, data: Uint8Array}

      // (e) Prépare l'objet {iv, data} encodé en base64 pour stockage texte
      const encryptedForDB = JSON.stringify({
        iv: toB64(encrypted.iv),
        data: toB64(encrypted.data),
      });

      // (f) Envoi au backend : encrypted_key non vide + salt
      const userObj = {
        username,
        email,
        password,
        passwordConfirm,
        role: "user",
        encrypted_key: encryptedForDB, // texte JSON {iv,data} (base64)
        encryption_salt: saltB64, // texte base64
      };

      await pb.collection("users").create(userObj);

      // 3) Suppression du code d’invitation après usage (comme avant)
      try {
        const codeRecord = await pb
          .collection("invites_codes")
          .getFirstListItem(`code="${inviteCode}"`);
        if (codeRecord && codeRecord.id) {
          await pb.collection("invites_codes").delete(codeRecord.id);
        }
      } catch (_) {
        console.warn("Erreur suppression code invitation");
      }

      setSuccess("Utilisateur créé avec succès");
      setUsername("");
      setInviteCode("");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
    } catch (err) {
      console.error("[Register] create error:", err);
      setError("Erreur lors de la création du compte");
    }
  };

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="w-full min-h-screen flex flex-col justify-center items-center">
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

          <Button
            type="submit"
            className=" bg-nodea-sage-dark hover:bg-nodea-sage-darker "
          >
            Créer le compte
          </Button>
        </form>
        <div className="mt-6 text-center w-full">
          <span className="text-gray-600">Déjà un compte ?</span>{" "}
          <a
            href="/login"
            className="text-nodea-sage underline hover:text-nodea-sage-dark"
          >
            Se connecter
          </a>
        </div>
      </div>
    </div>
  );
}
