import { useState } from "react";
import pb from "@/core/api/pocketbase";
import { useStore } from "@/core/store/StoreProvider";
import { useModulesRuntime } from "@/core/store/modulesRuntime";
import Button from "@/ui/atoms/base/Button";
import AccountSettingsCard from "@/ui/atoms/specifics/AccountSettingsCard.jsx";
import EncryptedActionGate from "@/ui/atoms/specifics/EncryptedActionGate.jsx";
import StatusBanner from "@/ui/atoms/feedback/StatusBanner.jsx";
// Orchestrate export via module plugins (pagination + decryption centralized)
import { getDataPlugin } from "@/core/utils/ImportExport/registry.data.js";

export default function ExportDataSection() {
  // Note: l'export s'appuie sur les plugins de chaque module (Mood/Goals/Passage)
  // via getDataPlugin(moduleKey) et plugin.exportQuery({ ctx }) afin d'unifier
  // pagination, d├®chiffrement et format. On construit un SEUL fichier JSON
  // { meta, modules: { mood?, goals?, passage? } } sans changer l'UI.
  const { mainKey } = useStore(); // cl├® binaire (Uint8Array)
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
      if (!mainKey) throw new Error("Cl├® de chiffrement absente");
      if (!sidMood && !sidGoals && !sidPassage)
        throw new Error(
          "Aucun module exportable configur├® (Mood/Goals/Passage)"
        );

      // Accumulateur par module (utilise les plugins d'export pour pagination + d├®chiffrement)
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
          // On laisse le plugin g├®rer la pagination et le d├®chiffrement
          // pageSize par d├®faut interne (certains plugins acceptent pageSize en option)
          for await (const payload of plugin.exportQuery({
            ctx,
            pageSize: 200,
          })) {
            // payload est d├®j├á en clair; si tu utilises NDJSON un jour: plugin.exportSerialize(payload)
            items.push(payload);
          }
          if (items.length) modulesOut[moduleKey] = items;
        } catch (err) {
          // On continue les autres modules; l'erreur sera refl├®t├®e dans le message global
          console.error(`Export ${moduleKey} ├®chou├®:`, err);
        }
      }

      if (!Object.keys(modulesOut).length) {
        setError("Aucune donn├®e ├á exporter");
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

      setSuccess("Export termin├®");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

    if (!mainKey) {
    return (
      <EncryptedActionGate
        title="Exporter mes données"
        description="Connecte-toi à nouveau pour exporter tes données."
        hint="Clé de chiffrement absente du cache"
      />
    );
  }

  return (
    <AccountSettingsCard
      title="Exporter mes données"
      description="Exporte un fichier JSON (non chiffré) des données."
    > className="border-gray-200 hover:border-gray-300">
      <div className="mb-4 w-full">
        <div className="text-base font-semibold text-gray-900 mb-1">
          Exporter mes donn├®es
        </div>
        <div className="text-sm text-gray-600">
          Exporte un fichier JSON (non chiffr├®) des donn├®es.
        </div>
      </div>
      <form className="flex flex-col gap-6 items-stretch">
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            onClick={() => {
              handleExport();
            }}
            disabled={loading || (!sidMood && !sidGoals && !sidPassage)}
            variant="info"
            className="disabled:opacity-50"
          >
            {loading ? "ChargementÔÇª" : "Exporter les donn├®es"}
          </Button>
        </div>
        {success ? (
          <StatusBanner tone="success">{success}</StatusBanner>
        ) : null}
        {error ? (
          <StatusBanner tone="error">{error}</StatusBanner>
        ) : null}
        {!sidMood && !sidGoals && !sidPassage && (
          <div className="text-xs text-amber-700 w-full text-center">
            Aucun module exportable nÔÇÖest configur├® (Mood/Goals/Passage).
          </div>
        )}
      </form>
    </AccountSettingsCard>
  );
}

