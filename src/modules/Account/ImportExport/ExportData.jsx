// src/modules/Account/ImportExport/ExportData.jsx
import React, { useState } from "react";
import pb from "@/services/pocketbase";
import { useMainKey } from "@/hooks/useMainKey";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { decryptAESGCM } from "@/services/webcrypto";
import KeyMissingMessage from "@/components/common/KeyMissingMessage";

export default function ExportDataSection() {
  const { mainKey } = useMainKey(); // clé binaire (Uint8Array)
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
          const txt = await decryptAESGCM(
            { iv: rec.cipher_iv, data: rec.payload },
            mainKey
          );
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
      <KeyMissingMessage
        label="Exporter mes données"
        help="Connecte-toi à nouveau pour récupérer la clé de chiffrement."
      />
    );
  }

  return (
    <section>
      <div className="flex flex-col gap-3">
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || !sid}
            className="inline-flex items-center rounded-md bg-nodea-sky-dark px-4 py-2 text-sm font-medium text-white hover:bg-nodea-sky-darker disabled:opacity-50"
          >
            {loading ? "Chargement…" : "Exporter les données"}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Exporte un fichier JSON (non chiffré) des données.
        </p>

        {success && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700"
          >
            {success}
          </div>
        )}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700"
          >
            {error}
          </div>
        )}
        {!sid && (
          <div className="text-xs text-amber-700">
            Module “Mood” non configuré.
          </div>
        )}
      </div>
    </section>
  );
}
