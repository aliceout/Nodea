// src/modules/Settings/Account/DeleteAccount.jsx
import React, { useState } from "react";
import pb from "@/services/pocketbase";
import { useNavigate } from "react-router-dom";
import Button from "@/components/common/Button";
import SettingsCard from "@/components/common/SettingsCard";

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
    <SettingsCard className="bg-rose-50 border-rose-300">
      <div className="mb-4 w-full">
        <div className="text-base font-semibold text-rose-700 mb-1">
          Supprimer mon compte
        </div>
        <div className="text-sm text-rose-700">
          La suppression est <strong>définitive</strong> et cette action est non
          réversible.
          <br />
          Toutes les données associées à ce compte seront perdues.
        </div>
      </div>
      <form className="w-full flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            onClick={handleDelete}
            className="bg-nodea-blush-dark !important font-semibold hover:bg-nodea-blush-darker !important"
          >
            Supprimer mon compte
          </Button>
        </div>
        {deleteError && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 w-full text-center"
          >
            {deleteError}
          </div>
        )}
      </form>
    </SettingsCard>
  );
}
