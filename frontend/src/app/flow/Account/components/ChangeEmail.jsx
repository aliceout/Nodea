import { useState } from "react";
import pb from "@/core/api/pocketbase";
import { useNavigate } from "react-router-dom";

import AccountSettingsCard from "@/ui/atoms/specifics/AccountSettingsCard.jsx";
import Button from "@/ui/atoms/base/Button";
import StatusBanner from "@/ui/atoms/feedback/StatusBanner.jsx";

export default function EmailSection() {
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
    <AccountSettingsCard
      title="Changer l’email"
      description="Tu recevras un mail de confirmation pour valider ce changement."
    >
      <form onSubmit={handleEmail} className="flex flex-col gap-6 items-stretch">
        <div className="w-full flex flex-col md:flex-row gap-8 items-stretch justify-between">
          <Button type="submit" variant="primarySoft">
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
        {emailSuccess ? (
          <StatusBanner tone="success">{emailSuccess}</StatusBanner>
        ) : null}
        {emailError ? (
          <StatusBanner tone="error">{emailError}</StatusBanner>
        ) : null}
      </form>
    </AccountSettingsCard>
  );
}
