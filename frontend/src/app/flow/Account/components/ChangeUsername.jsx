import { useState } from "react";
import pb from "@/core/api/pocketbase";
import AccountSettingsCard from "@/ui/atoms/specifics/AccountSettingsCard.jsx";
import Button from "@/ui/atoms/base/Button";
import StatusBanner from "@/ui/atoms/feedback/StatusBanner.jsx";

export default function UsernameSection({ user }) {
  const [username, setUsername] = useState(user?.username || "");
  const [usernameSuccess, setUsernameSuccess] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const handleUsername = async (e) => {
    e.preventDefault();
    setUsernameSuccess("");
    setUsernameError("");

    try {
      await pb.collection("users").update(user.id, { username });
      setUsernameSuccess("Nom d’utilisateur mis à jour.");
    } catch {
      setUsernameError("Erreur lors de la modification.");
    }
  };

  return (
    <AccountSettingsCard
      title="Changer le nom d’utilisateur·ice"
      description="Ton identifiant public dans l’appli."
    >
      <form onSubmit={handleUsername} className="flex flex-col gap-6 items-stretch">
        <div className="w-full flex flex-col md:flex-row gap-8 items-stretch justify-between">
          <Button type="submit" variant="primarySoft">
            Modifier
          </Button>
          <input
            id="username"
            type="text"
            placeholder="Nouveau nom d’utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="block w-full border-0 border-b-2 border-slate-300 focus:border-slate-500 focus:ring-0 focus:outline-none bg-transparent text-sm placeholder:text-sm transition-colors"
            required
          />
        </div>
        {usernameSuccess ? (
          <StatusBanner tone="success">{usernameSuccess}</StatusBanner>
        ) : null}
        {usernameError ? (
          <StatusBanner tone="error">{usernameError}</StatusBanner>
        ) : null}
      </form>
    </AccountSettingsCard>
  );
}
