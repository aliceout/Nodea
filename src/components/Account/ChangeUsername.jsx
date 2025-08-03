import React, { useState } from "react";
import pb from "../../services/pocketbase";

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
      setUsernameSuccess("Nom d'utilisateur mis à jour");
    } catch {
      setUsernameError("Erreur lors de la modification");
    }
  };

  return (
    <section className="p-4 shadow bg-white rounded">
      <form onSubmit={handleUsername}>
        <label className="block mb-1 font-semibold">
          Modifier le nom d'utilisateur
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-2 p-2 border rounded"
          required
        />
        {usernameSuccess && (
          <div className="text-green-600">{usernameSuccess}</div>
        )}
        {usernameError && <div className="text-red-500">{usernameError}</div>}
        <button
          type="submit"
          className="bg-sky-600 text-white px-4 py-2 rounded hover:bg-sky-700 mt-2"
        >
          Modifier
        </button>
      </form>
    </section>
  );
}
