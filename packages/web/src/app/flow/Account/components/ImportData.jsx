import React, { useState } from "react";
import pb from "@/core/api/pocketbase";
import { useStore } from "@/core/store/StoreProvider";
import { useModulesRuntime } from "@/core/store/modulesRuntime";
import AccountSettingsCard from "@/ui/atoms/specifics/AccountSettingsCard.jsx";
import EncryptedActionGate from "@/ui/atoms/specifics/EncryptedActionGate.jsx";
import StatusBanner from "@/ui/atoms/feedback/StatusBanner.jsx";

// Orchestration plugins par module (ex. Mood)
import { getDataPlugin } from "@/core/utils/ImportExport/registry.data.js";
import Button from "@/ui/atoms/base/Button";

export default function ImportData() {
  const { mainKey } = useStore(); // Uint8Array
  const modulesState = useModulesRuntime(); // { mood: { enabled, id:"m_..." }, ... }

  const sidMood = modulesState?.mood?.id || modulesState?.mood?.module_user_id; // compat legacy
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // PrÃ©conditions actuelles : clÃ© + (au moins) Mood configurÃ© pour les chemins legacy/NDJSON
  const ready = Boolean(mainKey && sidMood);

  function finish(inputEl) {
    setLoading(false);
    if (inputEl) inputEl.value = ""; // pouvoir rÃ©importer le mÃªme nom
  }

  // Util: rÃ©cupÃ¨re le sid d'un module activÃ©
  function getSid(moduleKey) {
    const cfg = modulesState?.[moduleKey];
    return cfg?.enabled ? cfg.id || cfg.module_user_id : null;
  }

  // --- Import tableau legacy: [ {date, mood_score, ...}, ... ] ---
  // (Compat historique : considÃ©rÃ© comme "mood" uniquement)
  async function importLegacyArray(array, inputEl) {
    try {
      if (!Array.isArray(array))
        throw new Error("Format JSON inattendu (array requis).");
      const moduleKey = "mood";
      const moduleSid = getSid(moduleKey);
      if (!moduleSid) throw new Error("Module 'Mood' non configurÃ©.");

      const plugin = await getDataPlugin(moduleKey);

      // Set des clÃ©s dÃ©jÃ  prÃ©sentes (si le plugin sait le faire)
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
        `Import terminÃ© : ${created} ajout(s), ${skipped} doublon(s) ignorÃ©(s).`
      );
      finish(inputEl);
    } catch (err) {
      setError("Erreur lors de lâ€™import : " + (err?.message || ""));
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
        if (!moduleSid) continue; // module non activÃ© â†’ ignore

        const plugin = await getDataPlugin(moduleKey);

        // Set des clÃ©s dÃ©jÃ  prÃ©sentes (si dispo), + set intra-fichier
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
        `Import terminÃ©${results.length ? ` (${results.join(" ; ")})` : ""}.`
      );
      finish(inputEl);
    } catch (err) {
      setError("Erreur lors de lâ€™import : " + (err?.message || ""));
      finish(inputEl);
    }
  }

  // --- Fallback NDJSON (une entrÃ©e JSON par ligne) ---
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
        if (!moduleSid) continue; // module non activÃ© â†’ ignore

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

      // message rÃ©cap
      const parts = [];
      for (const [k, { created, skipped }] of counters.entries()) {
        parts.push(`${k}: ${created} ajout(s), ${skipped} doublon(s)`);
      }
      setSuccess(
        `Import terminÃ©${parts.length ? ` (${parts.join(" ; ")})` : ""}.`
      );
      finish(inputEl);
    } catch (err) {
      setError("Erreur lors de lâ€™import NDJSON : " + (err?.message || ""));
      finish(inputEl);
    }
  }

  // --- Handler principal (sÃ©lection fichier) ---
  async function handleImport(evt) {
    const inputEl = evt?.target;
    const file = inputEl?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!ready) throw new Error("PrÃ©conditions manquantes (clÃ© ou module).");
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
        // NDJSON (une entrÃ©e par ligne)
        await importNdjson(trimmed, inputEl);
      }
    } catch (err) {
      setError("Erreur lors de lâ€™import : " + (err?.message || ""));
      finish(inputEl);
    }
  }

    if (!ready) {
    return (
      <EncryptedActionGate
        title="Importer des données"
        description="Connecte-toi à nouveau pour importer des données."
        hint="Clé de chiffrement absente du cache"
      />
    );
  }

  return (
    <AccountSettingsCard
      title="Importer des données"
      description="Les doublons seront ignorés automatiquement."
    >
      <form className="flex flex-col gap-6 items-stretch">
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            as="label"
            variant="info"
            className="disabled:opacity-50"
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
        {success ? (
          <StatusBanner tone="success">{success}</StatusBanner>
        ) : null}
        {error ? (
          <StatusBanner tone="error">{error}</StatusBanner>
        ) : null}
      </form>
    </AccountSettingsCard>
  );
}









