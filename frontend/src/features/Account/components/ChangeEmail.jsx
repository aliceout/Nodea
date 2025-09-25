import React, { useState } from "react";
import pb from "@/services/pocketbase";
import { useNavigate } from "react-router-dom";

import SettingsCard from "@/ui/feedback/SettingsCard";
import Button from "@/ui/components/Button";

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
    <SettingsCard className=" border-gray-200 hover:border-gray-300 ">
      <div className="mb-4 w-full">
        <div className="text-base font-semibold text-gray-900 mb-1">
          Changer l’email
        </div>
        <div className="text-sm text-gray-600">
          Tu recevras un mail de confirmation pour valider ce changement.
        </div>
      </div>
      <form
        onSubmit={handleEmail}
        className="w-full flex flex-col gap-6 items-stretch"
      >
        <div className="w-full flex flex-col md:flex-row gap-8 items-stretch justify-between">
          <Button
            type="submit"
            className="bg-nodea-sage hover:bg-nodea-sage-dark"
          >
            Modifier l’email
          </Button>
          <input
            id="newEmail"
            type="email"
            placeholder="Nouvel email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="block w-full border-0 border-b-2 border-slate-300 focus:border-slate-500 focus:ring-0 focus:outline-none bg-transparent text-sm placeholder:text-sm transition-colors"
            required
          />
        </div>
        {emailSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 w-full text-center"
          >
            {emailSuccess}
          </div>
        )}
        {emailError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 w-full text-center"
          >
            {emailError}
          </div>
        )}
      </form>
    </SettingsCard>
  );
}
