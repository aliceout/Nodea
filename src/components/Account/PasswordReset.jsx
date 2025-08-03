import React, { useState } from "react";
import pb from "../../services/pocketbase";

export default function PasswordResetSection({ user }) {
  const [pwResetSuccess, setPwResetSuccess] = useState("");
  const [pwResetError, setPwResetError] = useState("");

  const handlePasswordReset = async () => {
    setPwResetSuccess("");
    setPwResetError("");
    try {
      await pb.collection("users").requestPasswordReset(user.email);
      setPwResetSuccess("Mail de réinitialisation envoyé à " + user.email);
    } catch {
      setPwResetError("Erreur lors de l’envoi du mail");
    }
  };

  return (
    <section className="p-4 shadow bg-white rounded flex flex-col">
      <label className="block mb-1 font-semibold">
        Réinitialiser le mot de passe par email
      </label>
      <button
        className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 w-full"
        onClick={handlePasswordReset}
        type="button"
      >
        Envoyer le mail de réinitialisation
      </button>
      {pwResetSuccess && (
        <div className="text-green-600 mt-2">{pwResetSuccess}</div>
      )}
      {pwResetError && <div className="text-red-500 mt-2">{pwResetError}</div>}
      <div className="text-gray-500 text-xs mt-2">
        Tu recevras un mail de réinitialisation à l’adresse actuelle.
      </div>
    </section>
  );
}
