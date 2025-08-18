// src/modules/Settings/Account/ExportData.jsx
import React, { useState, useEffect } from "react";
import pb from "../../../services/pocketbase";
import { useMainKey } from "../../../hooks/useMainKey";
import { decryptAESGCM } from "../../../services/webcrypto";
import KeyMissingMessage from "../../../components/common/KeyMissingMessage";

export default function ExportDataSection({ user }) {
  const { mainKey } = useMainKey();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cryptoKey, setCryptoKey] = useState(null);

  useEffect(() => {
    if (mainKey) {
      window.crypto.subtle
        .importKey("raw", mainKey, { name: "AES-GCM" }, false, [
          "encrypt",
          "decrypt",
        ])
        .then(setCryptoKey);
    } else {
      setCryptoKey(null);
    }
  }, [mainKey]);

  const decryptField = async (field) => {
    if (!cryptoKey || !field) return "";
    try {
      return await decryptAESGCM(JSON.parse(field), cryptoKey);
    } catch {
      return "[Erreur de déchiffrement]";
    }
  };

  const handleExport = async () => {
    setSuccess("");
    setError("");
    setLoading(true);
    try {
      const entries = await pb.collection("journal_entries").getFullList({
        filter: `user="${user.id}"`,
        sort: "date",
        $autoCancel: false,
      });

      if (entries.length === 0) {
        setError("Aucune donnée à exporter");
        setLoading(false);
        return;
      }

      const decrypted = await Promise.all(
        entries.map(async (e) => ({
          id: e.id,
          date: e.date,
          mood_score: await decryptField(e.mood_score),
          mood_emoji: await decryptField(e.mood_emoji),
          positive1: await decryptField(e.positive1),
          positive2: await decryptField(e.positive2),
          positive3: await decryptField(e.positive3),
          question: await decryptField(e.question),
          answer: await decryptField(e.answer),
          comment: await decryptField(e.comment),
        }))
      );

      const data = JSON.stringify(decrypted, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${user?.username || user?.email || "nodea"}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setSuccess("Export terminé");
    } catch {
      setError("Erreur lors de l’export");
    } finally {
      setLoading(false);
    }
  };

  const ready = Boolean(user && cryptoKey);

  // 👉 Pas de bouton ni de texte explicatif si la clé n'est pas là
  if (!ready) {
    return (
      <section>
        <KeyMissingMessage context="exporter des données" />
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-col gap-3">
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="inline-flex items-center rounded-md bg-nodea-lavender-dark px-4 py-2 text-sm font-medium text-white hover:bg-nodea-lavender-darker disabled:opacity-60"
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
      </div>
    </section>
  );
}
