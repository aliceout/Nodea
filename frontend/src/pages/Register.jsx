import React, { useState } from "react";
import { deriveKeyArgon2, encryptAESGCM } from "@/core/crypto/webcrypto";
import pb from "@/core/api/pocketbase";
import Input from "@/ui/atoms/form/Input";
import Button from "@/ui/atoms/base/Button";
import FormFeedback from "@/ui/atoms/form/FormError";

function toB64(u8) {
  return btoa(String.fromCharCode(...u8));
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
    try {
      const mainKeyRaw = window.crypto.getRandomValues(new Uint8Array(32));
      const saltRaw = window.crypto.getRandomValues(new Uint8Array(16));
      const saltB64 = toB64(saltRaw);
      const protectionKeyBytes32 = await deriveKeyArgon2(password, saltB64);
      const encrypted = await encryptAESGCM(mainKeyRaw, protectionKeyBytes32);
      const encryptedForDB = JSON.stringify({
        iv: toB64(encrypted.iv),
        data: toB64(encrypted.data),
      });
      const userObj = {
        username,
        email,
        password,
        passwordConfirm,
        role: "user",
        encrypted_key: encryptedForDB,
        encryption_salt: saltB64,
      };
      await pb.collection("users").create(userObj);
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
          className="flex flex-col items-center gap-3 w-full max-w-md mx-auto p-8 bg-white rounded-lg md:shadow-lg"
        >
          <h1 className="text-2xl font-bold mb-6 text-center w-full">
            Créer un compte
          </h1>
          <div className="flex flex-row gap-2 justify-between w-full">
            <Input
              placeholder="Nom d'utilisateur"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full"
            />
            <Input
              placeholder="Code d’invitation"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              className="w-full"
            />
          </div>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full my-2"
          />
          <Input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full"
          />
          <Input
            type="password"
            placeholder="Confirme le mot de passe"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            className="w-full"
          />
          <FormFeedback message={error} type="error" className="w-full" />
          <FormFeedback message={success} type="success" className="w-full" />
          <Button
            type="submit"
            className=" bg-nodea-sage-dark hover:bg-nodea-sage-darker mt-4"
          >
            Créer le compte
          </Button>
        </form>
        <div className="mt-6 text-center w-full flex flex-col justify-center">
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
