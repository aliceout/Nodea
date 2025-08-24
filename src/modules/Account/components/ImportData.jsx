// src/modules/Settings/Account/ImportData.jsx
import React, { useState, useEffect } from "react";
import pb from "@/services/pocketbase";
import { useMainKey } from "@/hooks/useMainKey";
import { encryptAESGCM } from "@/services/webcrypto";
import KeyMissingMessage from "@/components/common/KeyMissingMessage";

export default function ImportData({ user }) {
  const { mainKey } = useMainKey();
  const [cryptoKey, setCryptoKey] = useState(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  console.log("ImportData rendered, mainKey:", mainKey);

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

  const handleImport = async (e) => {
    setError("");
    setSuccess("");
    setLoading(true);
    const file = e.target.files[0];
    if (!file) {
      setError("Aucun fichier sélectionné.");
      setLoading(false);
      return;
    }
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported))
        throw new Error("Fichier invalide (tableau attendu)");

      const existingEntries = await pb.collection("mood_entries").getFullList({
        filter: `user="${user.id}"`,
        fields: "date",
        $autoCancel: false,
      });
      const existingDates = new Set(
        existingEntries.map((e) => e.date.slice(0, 10))
      );

      let ignoredCount = 0;
      let importedCount = 0;

      for (const entry of imported) {
        const date = entry.date?.slice(0, 10);
        if (!date || existingDates.has(date) || !cryptoKey) {
          ignoredCount++;
          continue;
        }

        const encrypted = {
          user: user.id,
          date: entry.date,
          mood_score: JSON.stringify(
            await encryptAESGCM(entry.mood_score || "", cryptoKey)
          ),
          mood_emoji: JSON.stringify(
            await encryptAESGCM(entry.mood_emoji || "", cryptoKey)
          ),
          positive1: JSON.stringify(
            await encryptAESGCM(entry.positive1 || "", cryptoKey)
          ),
          positive2: JSON.stringify(
            await encryptAESGCM(entry.positive2 || "", cryptoKey)
          ),
          positive3: JSON.stringify(
            await encryptAESGCM(entry.positive3 || "", cryptoKey)
          ),
          question: JSON.stringify(
            await encryptAESGCM(entry.question || "", cryptoKey)
          ),
          answer: JSON.stringify(
            await encryptAESGCM(entry.answer || "", cryptoKey)
          ),
          comment: JSON.stringify(
            await encryptAESGCM(entry.comment || "", cryptoKey)
          ),
        };

        await pb.collection("mood_entries").create(encrypted);
        importedCount++;
      }

      setSuccess(
        `Import terminé : ${importedCount} entrée(s) ajoutée(s), ${ignoredCount} ignorée(s).`
      );
    } catch (err) {
      setError("Erreur lors de l’import : " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const ready = Boolean(user && cryptoKey);

  // 👉 Pas de bouton ni d’explication si la clé n’est pas là
  if (!ready) {
    return (
      <section>
        <KeyMissingMessage context="importer des données" />
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-col gap-3">
        <div className="flex items-center">
          <label
            htmlFor="import-json"
            className="inline-flex items-center justify-center rounded-md bg-nodea-lavender-dark px-4 py-2 text-sm font-medium text-white hover:bg-nodea-lavender-darker cursor-pointer"
            style={{ display: loading ? "none" : "inline-flex" }}
          >
            Sélectionner le fichier
            <input
              id="import-json"
              type="file"
              accept="application/json"
              onChange={handleImport}
              className="hidden"
              disabled={loading}
            />
          </label>
        </div>

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

        <p className="text-xs text-slate-500">
          Seules les dates absentes seront ajoutées. Type de fichier attendu :
          JSON.
        </p>
      </div>
    </section>
  );
}
