import React, { useState } from "react";
import pb from "../../services/pocketbase";
import { useNavigate } from "react-router-dom";

export default function DeleteAccountSection({ user }) {
  const [deleteError, setDeleteError] = useState("");
  const navigate = useNavigate();

  const handleDelete = async () => {
    setDeleteError("");
    if (
      !window.confirm(
        "Attention : cette action est irréversible. Supprimer définitivement ce compte ?"
      )
    )
      return;
    try {
      const journals = await pb.collection("journal_entries").getFullList({
        filter: `user="${user.id}"`,
      });
      for (const entry of journals) {
        await pb.collection("journal_entries").delete(entry.id);
      }
      await pb.collection("users").delete(user.id);
      pb.authStore.clear();
      navigate("/login");
    } catch {
      setDeleteError("Erreur lors de la suppression");
    }
  };

  return (
    <section className="p-4 shadow bg-white rounded">
      <label className="block mb-1 font-semibold">Suppression du compte</label>
      <button
        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 w-full"
        onClick={handleDelete}
      >
        Supprimer mon compte
      </button>
      {deleteError && <div className="text-red-500 mt-2">{deleteError}</div>}
      <div className="text-gray-500 text-xs mt-2">
        La suppression est définitive
      </div>
    </section>
  );
}
