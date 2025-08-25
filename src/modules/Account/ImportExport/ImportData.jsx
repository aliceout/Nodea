// src/modules/Account/ImportExport/ImportData.jsx
import React, { useState } from "react";
import pb from "@/services/pocketbase";
import { useMainKey } from "@/hooks/useMainKey";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { decryptAESGCM } from "@/services/webcrypto";
import KeyMissingMessage from "@/components/common/KeyMissingMessage";

// Orchestration plugins par module (ex. Mood)
import { getDataPlugin } from "./registry.data";

export default function ImportData() {
  const { mainKey } = useMainKey(); // Uint8Array
  const modulesState = useModulesRuntime(); // { mood: { enabled, id:"m_..." }, ... }
  const sidMood = modulesState?.mood?.id || modulesState?.mood?.module_user_id;

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ready = Boolean(mainKey && sidMood);

  function finish(inputEl) {
    setLoading(false);
    if (inputEl) inputEl.value = ""; // pouvoir réimporter le même nom
  }

  // Helper commun : charge et indexe les dates déjà présentes pour Mood
  async function getExistingMoodDates(pbClient, key, moduleUserId) {
    const page = await pbClient.collection("mood_entries").getList(1, 200, {
      query: { sid: moduleUserId, sort: "-created" }, // list/view via sid
    });
    const set = new Set();
    for (const rec of page.items || []) {
      try {
        const txt = await decryptAESGCM(
          { iv: rec.cipher_iv, data: rec.payload },
          key
        );
        const obj = JSON.parse(txt || "{}");
        if (obj?.date) set.add(String(obj.date));
      } catch {
        // on ignore les entrées illisibles
      }
    }
    return set;
  }

  // --- Import tableau legacy: [ {date, mood_score, ...}, ... ] ---
  async function importLegacyArray(array, inputEl) {
    try {
      if (!Array.isArray(array))
        throw new Error("Format JSON inattendu (array requis).");

      // 1) Index des dates déjà présentes
      const existingDates = await getExistingMoodDates(pb, mainKey, sidMood);

      // 2) Charge le plugin "mood" pour créer en 2 temps (POST init -> PATCH promotion)
      const moodPlugin = await getDataPlugin("mood");
      let created = 0;
      for (const payload of array) {
        const date = payload?.date && String(payload.date);
        if (!date || existingDates.has(date)) continue; // skip doublon
        await moodPlugin.importHandler({
          payload,
          ctx: { pb, moduleUserId: sidMood, mainKey },
        });
        existingDates.add(date);
        created++;
      }

      setSuccess(
        `Import terminé : ${created} nouvelle(s) entrée(s) ajoutée(s).`
      );
      finish(inputEl);
    } catch (err) {
      setError("Erreur lors de l’import : " + (err?.message || ""));
      finish(inputEl);
    }
  }

  // --- Import racine moderne: { meta, modules: { mood:[...], goals:[...] } } ---
  async function importRootJson(root, inputEl) {
    try {
      if (!root?.modules || typeof root.modules !== "object") {
        throw new Error("Format JSON invalide (modules manquant).");
      }

      const results = [];
      for (const [moduleKey, items] of Object.entries(root.modules)) {
        const moduleCfg = modulesState?.[moduleKey];
        if (!moduleCfg?.enabled || !Array.isArray(items) || !items.length)
          continue;

        const plugin = await getDataPlugin(moduleKey);
        const moduleSid = moduleCfg.id || moduleCfg.module_user_id;

        // Dédoublonnage Mood par date (clé naturelle du payload)
        let existingDates = null;
        if (moduleKey === "mood") {
          existingDates = await getExistingMoodDates(pb, mainKey, moduleSid);
        }

        let created = 0;
        for (const payload of items) {
          if (moduleKey === "mood") {
            const date = payload?.date && String(payload.date);
            if (!date || existingDates.has(date)) continue; // skip doublon
            await plugin.importHandler({
              payload,
              ctx: { pb, moduleUserId: moduleSid, mainKey },
            });
            existingDates.add(date);
            created++;
          } else {
            // autres modules : comportement inchangé (pas de clé naturelle définie ici)
            await plugin.importHandler({
              payload,
              ctx: { pb, moduleUserId: moduleSid, mainKey },
            });
            created++;
          }
        }
        results.push(`${moduleKey}: ${created}`);
      }

      setSuccess(
        `Import terminé ${results.length ? `(${results.join(", ")})` : ""}.`
      );
      finish(inputEl);
    } catch (err) {
      setError("Erreur lors de l’import : " + (err?.message || ""));
      finish(inputEl);
    }
  }

  // --- Fallback NDJSON (une entrée JSON par ligne) ---
  async function importNdjson(text, inputEl) {
    try {
      const plugin = await getDataPlugin("mood");

      // index des dates existantes pour Mood
      const existingDates = await getExistingMoodDates(pb, mainKey, sidMood);

      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      let created = 0;
      for (const line of lines) {
        if (!line.startsWith("{")) continue;
        let payload;
        try {
          payload = JSON.parse(line);
        } catch {
          continue;
        }
        const date = payload?.date && String(payload.date);
        if (!date || existingDates.has(date)) continue; // skip doublon

        await plugin.importHandler({
          payload,
          ctx: { pb, moduleUserId: sidMood, mainKey },
        });
        existingDates.add(date);
        created++;
      }
      setSuccess(`Import terminé : ${created} entrée(s).`);
      finish(inputEl);
    } catch (err) {
      setError("Erreur lors de l’import NDJSON : " + (err?.message || ""));
      finish(inputEl);
    }
  }

  // --- Handler principal (sélection fichier) ---
  async function handleImport(evt) {
    const inputEl = evt?.target;
    const file = inputEl?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!ready) throw new Error("Préconditions manquantes (clé ou module).");
      const text = await file.text();
      const trimmed = text.trim();

      if (trimmed.startsWith("{")) {
        // Export moderne { meta, modules }
        const root = JSON.parse(trimmed);
        await importRootJson(root, inputEl);
      } else if (trimmed.startsWith("[")) {
        // Export legacy tableau pour Mood
        const arr = JSON.parse(trimmed);
        await importLegacyArray(arr, inputEl);
      } else {
        // NDJSON (une entrée par ligne)
        await importNdjson(trimmed, inputEl);
      }
    } catch (err) {
      setError("Erreur lors de l’import : " + (err?.message || ""));
      finish(inputEl);
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
    <section>
      <div className="flex flex-col gap-3">
        <div className="flex items-center">
          <label
            htmlFor="import-json"
            className="inline-flex items-center rounded-md bg-nodea-sky-dark px-4 py-2 text-sm font-medium text-white hover:bg-nodea-sky-darker disabled:opacity-50"
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
          JSON.
        </p>
      </div>
    </section>
  );
}
