import React, { useState } from "react";
import pb from "../../../services/pocketbase";

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
    <section>
      <form onSubmit={handleUsername} className="flex flex-col gap-3">
        <div>
          <input
            id="username"
            type="text"
            placeholder="Nouveau nom d’utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-1/2 rounded-md border-slate-300 shadow-sm focus:border-slate-900 focus:ring-slate-900 text-sm placeholder:text-sm placeholder:text"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Ton identifiant public dans l’appli.
          </p>
        </div>

        {usernameSuccess && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700"
          >
            {usernameSuccess}
          </div>
        )}

        {usernameError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700"
          >
            {usernameError}
          </div>
        )}

        <div className="flex items-center">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-nodea-sage px-4 py-2 text-sm font-medium text-white hover:bg-nodea-sage-dark"
          >
            Modifier
          </button>
        </div>
      </form>
    </section>
  );
}
