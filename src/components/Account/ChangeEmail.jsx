import React, { useState } from "react";
import pb from "../../services/pocketbase";
import { useNavigate } from "react-router-dom";

export default function EmailSection({ user }) {
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const navigate = useNavigate();

  const handleEmail = async (e) => {
    e.preventDefault();
    setEmailError("");
    setEmailSuccess("");
    if (!newEmail) {
      setEmailError("Renseigne un nouvel email");
      return;
    }
    try {
      await pb.collection("users").requestEmailChange(newEmail);
      setEmailSuccess(
        "Un email de confirmation a été envoyé, la session va être déconnectée. La reconnexion sera possible après validation."
      );
      setTimeout(() => {
        pb.authStore.clear();
        navigate("/login");
      }, 6000);
      setNewEmail("");
    } catch (err) {
      if (err.data?.email) {
        setEmailError("Cet email est déjà utilisé.");
      } else {
        setEmailError("Erreur lors de la demande");
      }
    }
  };

  return (
    <section className="rounded p-4 shadow bg-white">
      <form onSubmit={handleEmail}>
        <label className="block mb-1 font-semibold">Changer l'email</label>
        <input
          type="email"
          placeholder="Nouvel email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="w-full mb-2 p-2 border rounded"
          required
        />
        {emailSuccess && <div className="text-green-600">{emailSuccess}</div>}
        {emailError && <div className="text-red-500">{emailError}</div>}
        <div className="flex items-center justify-between mt-2">
          <button
            type="submit"
            className="bg-sky-600 text-white px-4 py-2 rounded hover:bg-sky-700 basis-4/10"
          >
            Modifier l'email
          </button>
          <span className="text-gray-500 text-xs basis-6/10 text-left ml-3">
            Tu vas recevoir un mail de confirmation pour valider ce changement.
          </span>
        </div>
      </form>
    </section>
  );
}
