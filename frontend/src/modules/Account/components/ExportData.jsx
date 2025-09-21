import React, { useState } from "react";
import pb from "@/services/pocketbase";
import { useStore } from "@/store/StoreProvider";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { decryptWithRetry } from "@/services/decryptWithRetry";
import Button from "@/components/common/Button";
import SettingsCard from "@/components/shared/SettingsCard";
// Orchestrate export via module plugins (pagination + decryption centralized)
import { getDataPlugin } from "@/services/ImportExport/registry.data.js";

export default function ExportDataSection() {
  // Note: l'export s'appuie sur les plugins de chaque module (Mood/Goals/Passage)
  // via getDataPlugin(moduleKey) et plugin.exportQuery({ ctx }) afin d'unifier
  // pagination, déchiffrement et format. On construit un SEUL fichier JSON
  // { meta, modules: { mood?, goals?, passage? } } sans changer l'UI.
  const { mainKey, markMissing } = useStore(); // clé binaire (Uint8Array)
  const modules = useModulesRuntime(); // { mood: { enabled, id: "m_..." } }
  const sidMood = modules?.mood?.id || modules?.mood?.module_user_id;
  const sidGoals = modules?.goals?.id || modules?.goals?.module_user_id;
  const sidPassage = modules?.passage?.id || modules?.passage?.module_user_id;

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setSuccess("");
    setError("");
    setLoading(true);
    try {
      if (!mainKey) throw new Error("Clé de chiffrement absente");
      if (!sidMood && !sidGoals && !sidPassage)
        throw new Error(
          "Aucun module exportable configuré (Mood/Goals/Passage)"
        );

      // Accumulateur par module (utilise les plugins d'export pour pagination + déchiffrement)
      const modulesOut = {};
      const enabled = [
        sidMood ? "mood" : null,
        sidGoals ? "goals" : null,
        sidPassage ? "passage" : null,
      ].filter(Boolean);

      for (const moduleKey of enabled) {
        try {
          const sid =
            moduleKey === "mood"
              ? sidMood
              : moduleKey === "goals"
              ? sidGoals
              : sidPassage;
          const plugin = await getDataPlugin(moduleKey);
          const ctx = { moduleUserId: sid, mainKey, pb };

          const items = [];
          // On laisse le plugin gérer la pagination et le déchiffrement
          // pageSize par défaut interne (certains plugins acceptent pageSize en option)
          for await (const payload of plugin.exportQuery({
            ctx,
            pageSize: 200,
          })) {
            // payload est déjà en clair; si tu utilises NDJSON un jour: plugin.exportSerialize(payload)
            items.push(payload);
          }
          if (items.length) modulesOut[moduleKey] = items;
        } catch (err) {
          // On continue les autres modules; l'erreur sera reflétée dans le message global
          console.error(`Export ${moduleKey} échoué:`, err);
        }
      }

      if (!Object.keys(modulesOut).length) {
        setError("Aucune donnée à exporter");
        setLoading(false);
        return;
      }

      // Format d'export commun (multi-modules)
      const out = {
        meta: {
          version: 1,
          exported_at: new Date().toISOString(),
          app: "Nodea",
        },
        modules: modulesOut,
      };

      const blob = new Blob([JSON.stringify(out, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nodea_export_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setSuccess("Export terminé");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  if (!mainKey) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 mb-6 bg-white flex flex-col items-stretch">
        <div className="mb-4 w-full">
          <div className="text-base font-semibold text-gray-900 mb-1">
            Exporter mes données
          </div>
          <div className="text-sm text-gray-600">
            Connecte-toi à nouveau pour exporter tes données.
          </div>
        </div>
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 w-full text-center mb-2"
        >
          <p className="font-medium">Clé de chiffrement absente du cache</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsCard className=" border-gray-200 hover:border-gray-300 ">
      <div className="mb-4 w-full">
        <div className="text-base font-semibold text-gray-900 mb-1">
          Exporter mes données
        </div>
        <div className="text-sm text-gray-600">
          Exporte un fichier JSON (non chiffré) des données.
        </div>
      </div>
      <form className="w-full flex flex-col gap-6 items-stretch">
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            onClick={(e) => {
              handleExport(e);
            }}
            disabled={loading || (!sidMood && !sidGoals && !sidPassage)}
            className=" bg-nodea-sky-dark hover:bg-nodea-sky-darker disabled:opacity-50"
          >
            {loading ? "Chargement…" : "Exporter les données"}
          </Button>
        </div>
        {success && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 w-full text-center"
          >
            {success}
          </div>
        )}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 w-full text-center"
          >
            {error}
          </div>
        )}
        {!sidMood && !sidGoals && !sidPassage && (
          <div className="text-xs text-amber-700 w-full text-center">
            Aucun module exportable n’est configuré (Mood/Goals/Passage).
          </div>
        )}
      </form>
    </SettingsCard>
  );
}
