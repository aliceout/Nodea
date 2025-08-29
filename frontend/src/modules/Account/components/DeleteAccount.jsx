// src/modules/Settings/Account/DeleteAccount.jsx
import React, { useState } from "react";
import pb from "@/services/pocketbase";
import { MODULES } from "@/config/modules_list";
import { loadModulesConfig } from "@/services/modules-config";
import { deriveGuard } from "@/modules/Mood/data/moodEntries";
import { useNavigate } from "react-router-dom";
import Button from "@/components/common/Button";
import SettingsCard from "@/components/common/SettingsCard";

export default function DeleteAccountSection({ user }) {
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const handleDelete = async () => {
    setDeleteError("");
    if (
      !window.confirm(
        "Attention : cette action est irréversible. Supprimer définitivement ce compte et toutes les données associées ?"
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      // 1. Charger la config modules pour récupérer les ids secondaires
      let moduleConfig = {};
      try {
        moduleConfig = await loadModulesConfig(pb, user.id, window.mainKey);
      } catch {}

      // 2. Pour chaque module avec une collection, supprimer toutes les entrées liées
      for (const mod of MODULES) {
        if (!mod.collection) continue;
        // Supprimer par module_user_id si présent
        const entry = moduleConfig[mod.id];
        if (entry && entry.module_user_id) {
          const entriesByModuleId = await pb
            .collection(mod.collection)
            .getFullList({
              filter: `module_user_id="${entry.module_user_id}"`,
            });
          for (const e of entriesByModuleId) {
            // Suppression avec guard si possible
            try {
              const guard = await deriveGuard(
                window.mainKey,
                entry.module_user_id,
                e.id
              );
              const url = `/api/collections/${
                mod.collection
              }/records/${encodeURIComponent(e.id)}?sid=${encodeURIComponent(
                entry.module_user_id
              )}&d=${encodeURIComponent(guard)}`;
              const res = await pb.send(url, { method: "DELETE" });
              if (res?.status && res.status !== 204) {
                console.error(
                  `Suppression échouée pour ${mod.collection} id=${e.id} status=${res.status}`
                );
              }
            } catch (err) {
              // fallback: suppression brute si le module n'utilise pas le guard
              try {
                await pb.collection(mod.collection).delete(e.id);
              } catch (err2) {
                console.error(
                  `Suppression brute échouée pour ${mod.collection} id=${e.id}`,
                  err2
                );
              }
            }
          }
        }
      }
      // 3. Supprimer l'utilisateur
      await pb.collection("users").delete(user.id);
      pb.authStore.clear();
      navigate("/login");
    } catch {
      setDeleteError("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
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
            disabled={deleting}
          >
            {deleting ? "Suppression en cours…" : "Supprimer mon compte"}
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
