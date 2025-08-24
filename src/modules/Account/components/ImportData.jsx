// src/modules/Settings/Account/ImportData.jsx
import React, { useState } from "react";
import { useMainKey } from "@/hooks/useMainKey";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { decryptAESGCM } from "@/services/webcrypto";
import { listMoodEntries, createMoodEntry } from "@/services/moodEntries";
import KeyMissingMessage from "@/components/common/KeyMissingMessage";

export default function ImportData() {
  const { mainKey } = useMainKey(); // clé brute attendue (Uint8Array)
  const modules = useModulesRuntime();
  const moduleUserId = modules?.mood?.id || modules?.mood?.module_user_id;

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ready = Boolean(mainKey && moduleUserId);

  async function handleImport(e) {
    setError("");
    setSuccess("");
    setLoading(true);

    const file = e.target.files?.[0];
    if (!file) {
      setError("Aucun fichier sélectionné.");
      setLoading(false);
      return;
    }

    try {
      // 1) Lire & parser le JSON fourni
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) {
        throw new Error("Fichier invalide : un tableau JSON est attendu.");
      }

      // 2) Construire l'index des dates déjà présentes (via LIST + déchiffrement)
      const existingItems = await listMoodEntries(moduleUserId);
      const existingDates = new Set();
      for (const r of existingItems) {
        try {
          const plaintext = await decryptAESGCM(
            { iv: r.cipher_iv, data: r.payload },
            mainKey
          );
          const obj = JSON.parse(plaintext || "{}");
          const d = (
            obj.date || (r.created ? String(r.created).slice(0, 10) : "")
          ).slice(0, 10);
          if (d) existingDates.add(d);
        } catch {
          // ignore entrées illisibles
        }
      }

      // 3) Importer en dédupliquant par date (si déjà présente => ignore)
      let ignored = 0;
      let importedCount = 0;

      for (const entry of imported) {
        const date = String(entry?.date || "").slice(0, 10);
        if (!date) {
          ignored++;
          continue;
        }
        if (existingDates.has(date)) {
          ignored++;
          continue;
        }

        // Construire le payload clair attendu par le module Mood
        // (on n'embarque question/answer QUE si answer non-vide)
        const includeQA = !!String(entry?.answer || "").trim();

        const payload = {
          date,
          mood_score: String(entry?.mood_score ?? ""),
          mood_emoji: String(entry?.mood_emoji ?? ""),
          positive1: String(entry?.positive1 ?? ""),
          positive2: String(entry?.positive2 ?? ""),
          positive3: String(entry?.positive3 ?? ""),
          comment: String(entry?.comment ?? ""),
          ...(includeQA
            ? {
                question: String(entry?.question ?? ""),
                answer: String(entry?.answer ?? ""),
              }
            : {}),
        };

        // Sanity minimale : note et 3 positifs requis (comme dans Form)
        if (
          payload.mood_score === "" ||
          !payload.positive1.trim() ||
          !payload.positive2.trim() ||
          !payload.positive3.trim() ||
          !payload.mood_emoji
        ) {
          ignored++;
          continue;
        }

        // Création 2 temps (POST "init" + PATCH HMAC) via le service
        await createMoodEntry({
          moduleUserId,
          mainKey,
          payload,
        });

        existingDates.add(date);
        importedCount++;
      }

      setSuccess(
        `Import terminé : ${importedCount} entrée(s) ajoutée(s), ${ignored} ignorée(s).`
      );
    } catch (err) {
      setError("Erreur lors de l’import : " + (err?.message || ""));
    } finally {
      setLoading(false);
      // réinitialiser l'input file pour pouvoir réimporter le même nom
      e.target.value = "";
    }
  }

  if (!ready) {
    return (
      <section className="p-4">
        <KeyMissingMessage context="importer des données d'humeur" />
      </section>
    );
  }

  return (
    <section className="p-4">
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
          {loading && (
            <span className="text-sm ml-2 opacity-70">Import en cours…</span>
          )}
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
          JSON (voir format ci-dessous).
        </p>
      </div>
    </section>
  );
}
