import React, { useState } from "react";
import pb from "../../../services/pocketbase";
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
      if (err?.data?.email) {
        setEmailError("Cet email est déjà utilisé.");
      } else {
        setEmailError("Erreur lors de la demande.");
      }
    }
  };

  return (
    <section>
      <form onSubmit={handleEmail} className="flex flex-col gap-3">
        <div>
          <input
            id="newEmail"
            type="email"
            placeholder="Nouvel email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="mt-1 block w-1/2 rounded-md border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 text-sm placeholder:text-sm placeholder:text"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Tu recevras un mail de confirmation pour valider ce changement.
          </p>
        </div>
        {emailSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700"
          >
            {emailSuccess}
          </div>
        )}
        {emailError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700"
          >
            {emailError}
          </div>
        )}
        <div className="flex items-center">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-nodea-sage px-4 py-2 text-sm font-medium text-white hover:bg-nodea-sage-dark"
          >
            Modifier l’email
          </button>
        </div>
      </form>
    </section>
  );
}
