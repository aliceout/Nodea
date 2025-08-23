// src/modules/Settings/Account/DeleteAccount.jsx
import React, { useState } from "react";
import pb from "../../../services/pocketbase";
import { useNavigate } from "react-router-dom";

export default function DeleteAccountSection({ user }) {
  const [deleteError, setDeleteError] = useState("");
  const navigate = useNavigate();

  const handleDelete = async () => {
    setDeleteError("");
    if (
      !window.confirm(
        "Attention : cette action est irréversible. Supprimer définitivement ce compte ?"
      )
    ) {
      return;
    }
    try {
      const journals = await pb.collection("mood_entries").getFullList({
        filter: `user="${user.id}"`,
      });
      for (const entry of journals) {
        await pb.collection("mood_entries").delete(entry.id);
      }
      await pb.collection("users").delete(user.id);
      pb.authStore.clear();
      navigate("/login");
    } catch {
      setDeleteError("Erreur lors de la suppression");
    }
  };

  return (
    <section>
      <div className="flex flex-col gap-3">
        {deleteError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700"
          >
            {deleteError}
          </div>
        )}

        <div className="flex items-center">
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center rounded-md bg-nodea-blush-dark px-4 py-2 text-sm font-medium text-white hover:bg-nodea-blush-darker "
          >
            Supprimer mon compte
          </button>
        </div>

        <p className="text-xs text-slate-500">
          La suppression est <strong>définitive</strong>
          <br /> Toutes les données associées à ce compte seront perdues. Cette
          action est non réversible.
        </p>
      </div>
    </section>
  );
}
