import React, { useState } from "react";
import pb from "@/core/api/pocketbase";
import { useStore } from "@/core/store/StoreProvider";
import { useModulesRuntime } from "@/core/store/modulesRuntime";
import SettingsCard from "@/ui/atoms/specifics/SettingsCard";

// Orchestration plugins par module (ex. Mood)
import { getDataPlugin } from "@/core/utils/importExport/registry.data.js";
import Button from "@/ui/atoms/base/Button";

export default function ImportData() {
  const { mainKey } = useStore(); // Uint8Array
  const modulesState = useModulesRuntime(); // { mood: { enabled, id:"m_..." }, ... }

  const sidMood = modulesState?.mood?.id || modulesState?.mood?.module_user_id; // compat legacy
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Préconditions actuelles : clé + (au moins) Mood configuré pour les chemins legacy/NDJSON
  const ready = Boolean(mainKey && sidMood);

  function finish(inputEl) {
    setLoading(false);
    if (inputEl) inputEl.value = ""; // pouvoir réimporter le même nom
  }

  // Util: récupère le sid d'un module activé
  function getSid(moduleKey) {
    const cfg = modulesState?.[moduleKey];
    return cfg?.enabled ? cfg.id || cfg.module_user_id : null;
  }

  // --- Import tableau legacy: [ {date, mood_score, ...}, ... ] ---
  // (Compat historique : considéré comme "mood" uniquement)
  async function importLegacyArray(array, inputEl) {
    try {
      if (!Array.isArray(array))
        throw new Error("Format JSON inattendu (array requis).");
      const moduleKey = "mood";
      const moduleSid = getSid(moduleKey);
      if (!moduleSid) throw new Error("Module 'Mood' non configuré.");

      const plugin = await getDataPlugin(moduleKey);

      // Set des clés déjà présentes (si le plugin sait le faire)
      const existing =
        typeof plugin.listExistingKeys === "function"
          ? await plugin.listExistingKeys({ pb, sid: moduleSid, mainKey })
          : new Set();

      const seenInFile = new Set();
      let created = 0,
        skipped = 0;

      for (const payload of array) {
        const key =
          typeof plugin.getNaturalKey === "function"
            ? plugin.getNaturalKey(payload)
            : null;

        if (key && (existing.has(key) || seenInFile.has(key))) {
          skipped++; // doublon
          continue;
        }

        await plugin.importHandler({
          payload,
          ctx: { pb, moduleUserId: moduleSid, mainKey },
        });

        if (key) {
          existing.add(key);
          seenInFile.add(key);
        }
        created++;
      }

      setSuccess(
        `Import terminé : ${created} ajout(s), ${skipped} doublon(s) ignoré(s).`
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
        if (!Array.isArray(items) || !items.length) continue;

        const moduleSid = getSid(moduleKey);
        if (!moduleSid) continue; // module non activé → ignore

        const plugin = await getDataPlugin(moduleKey);

        // Set des clés déjà présentes (si dispo), + set intra-fichier
        const existing =
          typeof plugin.listExistingKeys === "function"
            ? await plugin.listExistingKeys({ pb, sid: moduleSid, mainKey })
            : new Set();
        const seenInFile = new Set();

        let created = 0,
          skipped = 0;
        for (const payload of items) {
          const key =
            typeof plugin.getNaturalKey === "function"
              ? plugin.getNaturalKey(payload)
              : null;

          if (key && (existing.has(key) || seenInFile.has(key))) {
            skipped++; // doublon
            continue;
          }

          await plugin.importHandler({
            payload,
            ctx: { pb, moduleUserId: moduleSid, mainKey },
          });

          if (key) {
            existing.add(key);
            seenInFile.add(key);
          }
          created++;
        }

        results.push(
          `${moduleKey}: ${created} ajout(s), ${skipped} doublon(s)`
        );
      }

      setSuccess(
        `Import terminé${results.length ? ` (${results.join(" ; ")})` : ""}.`
      );
      finish(inputEl);
    } catch (err) {
      setError("Erreur lors de l’import : " + (err?.message || ""));
      finish(inputEl);
    }
  }

  // --- Fallback NDJSON (une entrée JSON par ligne) ---
  // Accepte soit {module, version, payload}, soit un payload "mood" nu (legacy)
  async function importNdjson(text, inputEl) {
    try {
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      // caches par module
      const pluginCache = new Map(); // moduleKey -> plugin
      const existingByModule = new Map(); // moduleKey -> Set(keys)
      const seenByModule = new Map(); // moduleKey -> Set(keys) dans ce fichier
      const counters = new Map(); // moduleKey -> {created, skipped}

      for (const line of lines) {
        if (!line.startsWith("{")) continue;

        let obj;
        try {
          obj = JSON.parse(line);
        } catch {
          continue;
        }

        let moduleKey, payload;

        if (
          obj &&
          typeof obj === "object" &&
          "module" in obj &&
          "payload" in obj
        ) {
          moduleKey = obj.module;
          payload = obj.payload;
        } else {
          // legacy NDJSON mood
          moduleKey = "mood";
          payload = obj;
        }

        const moduleSid = getSid(moduleKey);
        if (!moduleSid) continue; // module non activé → ignore

        // plugin
        let plugin = pluginCache.get(moduleKey);
        if (!plugin) {
          plugin = await getDataPlugin(moduleKey);
          pluginCache.set(moduleKey, plugin);
        }

        // sets
        if (!existingByModule.has(moduleKey)) {
          const existing =
            typeof plugin.listExistingKeys === "function"
              ? await plugin.listExistingKeys({ pb, sid: moduleSid, mainKey })
              : new Set();
          existingByModule.set(moduleKey, existing);
        }
        if (!seenByModule.has(moduleKey)) {
          seenByModule.set(moduleKey, new Set());
        }
        if (!counters.has(moduleKey)) {
          counters.set(moduleKey, { created: 0, skipped: 0 });
        }

        const existing = existingByModule.get(moduleKey);
        const seen = seenByModule.get(moduleKey);
        const stats = counters.get(moduleKey);

        const key =
          typeof plugin.getNaturalKey === "function"
            ? plugin.getNaturalKey(payload)
            : null;

        if (key && (existing.has(key) || seen.has(key))) {
          stats.skipped++;
          continue;
        }

        await plugin.importHandler({
          payload,
          ctx: { pb, moduleUserId: moduleSid, mainKey },
        });

        if (key) {
          existing.add(key);
          seen.add(key);
        }
        stats.created++;
      }

      // message récap
      const parts = [];
      for (const [k, { created, skipped }] of counters.entries()) {
        parts.push(`${k}: ${created} ajout(s), ${skipped} doublon(s)`);
      }
      setSuccess(
        `Import terminé${parts.length ? ` (${parts.join(" ; ")})` : ""}.`
      );
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
        // Export legacy tableau (mood)
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
      <div className="rounded-lg border border-gray-200 p-6 mb-6 bg-white flex flex-col items-stretch">
        <div className="mb-4 w-full">
          <div className="text-base font-semibold text-gray-900 mb-1">
            Importer des données
          </div>
          <div className="text-sm text-gray-600">
            Connecte-toi à nouveau pour importer des données.
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
          Importer des données
        </div>
        <div className="text-sm text-gray-600">
          Les doublons seront ignorés automatiquement.
        </div>
      </div>
      <form className="w-full flex flex-col gap-6 items-stretch">
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            className=" bg-nodea-sky-dark hover:bg-nodea-sky-darker disabled:opacity-50"
            as="label"
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
          </Button>
        </div>
        {loading && (
          <span className="text-sm ml-2 opacity-70 w-full text-center">
            Import en cours…
          </span>
        )}
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
      </form>
    </SettingsCard>
  );
}
