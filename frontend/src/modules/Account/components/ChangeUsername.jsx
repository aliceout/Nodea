import React, { useState } from "react";
import pb from "@/services/pocketbase";
import SettingsCard from "@/components/common/SettingsCard";

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
    <SettingsCard className=" border-gray-200 hover:border-gray-300 ">
      <div className="mb-4 w-full">
        <div className="text-base font-semibold text-gray-900 mb-1">
          Changer le nom d’utilisateur·ice
        </div>
        <div className="text-sm text-gray-600">
          Ton identifiant public dans l’appli.
        </div>
      </div>
      <form
        onSubmit={handleUsername}
        className="w-full flex flex-col gap-6 items-stretch"
      >
        <div className="w-full flex flex-col md:flex-row gap-8 items-stretch justify-between">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-nodea-sage px-6 py-2 text-sm font-medium text-white hover:bg-nodea-sage-dark whitespace-nowrap md:self-end"
          >
            Modifier
          </button>
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
        {usernameSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 w-full text-center"
          >
            {usernameSuccess}
          </div>
        )}
        {usernameError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 w-full text-center"
          >
            {usernameError}
          </div>
        )}
      </form>
    </SettingsCard>
  );
}
