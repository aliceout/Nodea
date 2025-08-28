// src/modules/Account/ImportExport/ExportData.jsx
import React, { useState } from "react";
import pb from "@/services/pocketbase";
import { useStore } from "@/store/StoreProvider";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { decryptWithRetry } from "@/services/decryptWithRetry";
import Button from "../../../components/common/Button";
import SettingsCard from "../components/SettingsCard";

export default function ExportDataSection() {
  const { mainKey, markMissing } = useStore(); // clé binaire (Uint8Array)
  const modules = useModulesRuntime(); // { mood: { enabled, id: "m_..." } }
  const sid = modules?.mood?.id || modules?.mood?.module_user_id;

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setSuccess("");
    setError("");
    setLoading(true);
    try {
      if (!mainKey) throw new Error("Clé de chiffrement absente");
      if (!sid) throw new Error("Module 'Mood' non configuré");

      // Lecture via règle ?sid, puis déchiffrement du payload
      const page = await pb.collection("mood_entries").getList(1, 200, {
        query: { sid, sort: "-created" },
      });

      const items = page?.items || [];
      if (!items.length) {
        setError("Aucune donnée à exporter");
        setLoading(false);
        return;
      }

      const plain = await Promise.all(
        items.map(async (rec) => {
          const txt = await decryptWithRetry({
            encrypted: { iv: rec.cipher_iv, data: rec.payload },
            key: mainKey,
            markMissing,
          });
          return JSON.parse(txt || "{}");
        })
      );

      // Format d'export commun
      const out = {
        meta: {
          version: 1,
          exported_at: new Date().toISOString(),
          app: "Nodea",
        },
        modules: { mood: plain },
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
            onClick={handleExport}
            disabled={loading || !sid}
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
        {!sid && (
          <div className="text-xs text-amber-700 w-full text-center">
            Module “Mood” non configuré.
          </div>
        )}
      </form>
    </SettingsCard>
  );
}
