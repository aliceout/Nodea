import { useState } from "react";
import { useNodeaStore, selectMainKey, selectModules } from "@/core/store/nodea-store";
import Button from "@/ui/atoms/base/Button";
import AccountSettingsCard from "@/ui/atoms/specifics/AccountSettingsCard";
import EncryptedActionGate from "@/ui/atoms/specifics/EncryptedActionGate";
import StatusBanner from "@/ui/atoms/feedback/StatusBanner";
import {
  getDataPlugin,
  knownModules,
} from "@/core/utils/ImportExport/registry.data.js";

/**
 * Exporte toutes les données (en clair, après déchiffrement local) dans un
 * unique fichier JSON. Parcours la registry des plugins : pour chaque
 * module registered (mood, goals, passage, habits_items, habits_logs,
 * library_items, library_reviews, review), si le module runtime est activé
 * pour l'utilisateur·ice, on itère `plugin.exportQuery` et on accumule.
 */
export default function ExportDataSection() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setSuccess("");
    setError("");
    setLoading(true);
    try {
      if (!mainKey) throw new Error("Clé de chiffrement absente");

      // Iterate every known registry key; for each, resolve the sid
      // from the Zustand modules slice using the plugin's runtimeKey.
      const modulesOut = {};
      for (const moduleKey of knownModules()) {
        try {
          const plugin = await getDataPlugin(moduleKey);
          const runtimeKey = plugin.meta?.runtimeKey ?? moduleKey;
          const sid = modules?.[runtimeKey]?.moduleUserId;
          if (!sid) continue;

          const items = [];
          for await (const payload of plugin.exportQuery({
            ctx: { moduleUserId: sid, mainKey },
            pageSize: 200,
          })) {
            items.push(payload);
          }
          if (items.length) modulesOut[moduleKey] = items;
        } catch (err) {
          console.error(`Export ${moduleKey} échoué:`, err);
        }
      }

      if (!Object.keys(modulesOut).length) {
        setError("Aucune donnée à exporter");
        setLoading(false);
        return;
      }

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
      <EncryptedActionGate
        title="Exporter mes données"
        description="Connecte-toi à nouveau pour exporter tes données."
        hint="Clé de chiffrement absente du cache"
      />
    );
  }

  const anyModuleEnabled = knownModules().some(
    (k) => modules?.[k]?.moduleUserId || modules?.[k.replace(/_/g, "-")]?.moduleUserId,
  );

  return (
    <AccountSettingsCard
      title="Exporter mes données"
      description="Exporte un fichier JSON (non chiffré) de toutes les données."
    >
      <form className="flex flex-col gap-6 items-stretch">
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            onClick={handleExport}
            disabled={loading || !anyModuleEnabled}
            variant="info"
            className="disabled:opacity-50"
          >
            {loading ? "Chargement…" : "Exporter les données"}
          </Button>
        </div>
        {success ? <StatusBanner tone="success">{success}</StatusBanner> : null}
        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
        {!anyModuleEnabled ? (
          <div className="text-xs text-amber-700 w-full text-center">
            Aucun module exportable n'est activé.
          </div>
        ) : null}
      </form>
    </AccountSettingsCard>
  );
}
