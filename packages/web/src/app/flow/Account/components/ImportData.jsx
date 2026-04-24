import { useState } from "react";
import { useNodeaStore, selectMainKey, selectModules } from "@/core/store/nodea-store";
import AccountSettingsCard from "@/ui/atoms/specifics/AccountSettingsCard";
import EncryptedActionGate from "@/ui/atoms/specifics/EncryptedActionGate";
import StatusBanner from "@/ui/atoms/feedback/StatusBanner";
import Button from "@/ui/atoms/base/Button";
import { getDataPlugin } from "@/core/utils/ImportExport/registry.data.js";

/**
 * Importe un fichier JSON exporté précédemment. Trois formats acceptés :
 *
 *   1. `{ meta, modules: { mood: [...], goals: [...], ... } }` — export
 *      Nodea multi-module.
 *   2. `[ {date, mood_score, ...}, ... }` — legacy Mood en tableau brut.
 *   3. NDJSON (une entrée JSON par ligne), `{module, version, payload}`
 *      ou payload Mood nu.
 *
 * Les doublons sont détectés via la clé naturelle de chaque plugin et
 * ignorés sans erreur.
 */
export default function ImportData() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ready = Boolean(mainKey);

  function finish(inputEl) {
    setLoading(false);
    if (inputEl) inputEl.value = "";
  }

  async function resolveSidForPlugin(plugin) {
    const runtimeKey = plugin.meta?.runtimeKey ?? plugin.meta?.id;
    const cfg = modules?.[runtimeKey];
    return cfg?.enabled ? cfg.moduleUserId : null;
  }

  async function importLegacyArray(array, inputEl) {
    try {
      if (!Array.isArray(array))
        throw new Error("Format JSON inattendu (array requis).");
      const plugin = await getDataPlugin("mood");
      const sid = await resolveSidForPlugin(plugin);
      if (!sid) throw new Error("Module 'Mood' non activé.");

      const existing = await plugin.listExistingKeys({ sid, mainKey });
      const seenInFile = new Set();
      let created = 0;
      let skipped = 0;

      for (const payload of array) {
        const key = plugin.getNaturalKey?.(payload) ?? null;
        if (key && (existing.has(key) || seenInFile.has(key))) {
          skipped++;
          continue;
        }
        await plugin.importHandler({
          payload,
          ctx: { moduleUserId: sid, mainKey },
        });
        if (key) {
          existing.add(key);
          seenInFile.add(key);
        }
        created++;
      }

      setSuccess(
        `Import terminé : ${created} ajout(s), ${skipped} doublon(s) ignoré(s).`,
      );
      finish(inputEl);
    } catch (err) {
      setError("Erreur lors de l'import : " + (err?.message || ""));
      finish(inputEl);
    }
  }

  async function importRootJson(root, inputEl) {
    try {
      if (!root?.modules || typeof root.modules !== "object") {
        throw new Error("Format JSON invalide (modules manquant).");
      }

      const results = [];
      for (const [moduleKey, items] of Object.entries(root.modules)) {
        if (!Array.isArray(items) || !items.length) continue;

        let plugin;
        try {
          plugin = await getDataPlugin(moduleKey);
        } catch {
          results.push(`${moduleKey}: ignoré (module inconnu)`);
          continue;
        }

        const sid = await resolveSidForPlugin(plugin);
        if (!sid) {
          results.push(`${moduleKey}: ignoré (module non activé)`);
          continue;
        }

        const existing = await plugin.listExistingKeys({ sid, mainKey });
        const seenInFile = new Set();
        let created = 0;
        let skipped = 0;

        for (const payload of items) {
          const key = plugin.getNaturalKey?.(payload) ?? null;
          if (key && (existing.has(key) || seenInFile.has(key))) {
            skipped++;
            continue;
          }
          await plugin.importHandler({
            payload,
            ctx: { moduleUserId: sid, mainKey },
          });
          if (key) {
            existing.add(key);
            seenInFile.add(key);
          }
          created++;
        }

        results.push(`${moduleKey}: ${created} ajout(s), ${skipped} doublon(s)`);
      }

      setSuccess(
        `Import terminé${results.length ? ` (${results.join(" ; ")})` : ""}.`,
      );
      finish(inputEl);
    } catch (err) {
      setError("Erreur lors de l'import : " + (err?.message || ""));
      finish(inputEl);
    }
  }

  async function importNdjson(text, inputEl) {
    try {
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const pluginCache = new Map();
      const existingByModule = new Map();
      const seenByModule = new Map();
      const counters = new Map();

      for (const line of lines) {
        if (!line.startsWith("{")) continue;

        let obj;
        try {
          obj = JSON.parse(line);
        } catch {
          continue;
        }

        let moduleKey;
        let payload;
        if (obj && typeof obj === "object" && "module" in obj && "payload" in obj) {
          moduleKey = obj.module;
          payload = obj.payload;
        } else {
          moduleKey = "mood";
          payload = obj;
        }

        let plugin = pluginCache.get(moduleKey);
        if (!plugin) {
          try {
            plugin = await getDataPlugin(moduleKey);
            pluginCache.set(moduleKey, plugin);
          } catch {
            continue;
          }
        }

        const sid = await resolveSidForPlugin(plugin);
        if (!sid) continue;

        if (!existingByModule.has(moduleKey)) {
          existingByModule.set(
            moduleKey,
            await plugin.listExistingKeys({ sid, mainKey }),
          );
        }
        if (!seenByModule.has(moduleKey)) seenByModule.set(moduleKey, new Set());
        if (!counters.has(moduleKey))
          counters.set(moduleKey, { created: 0, skipped: 0 });

        const existing = existingByModule.get(moduleKey);
        const seen = seenByModule.get(moduleKey);
        const stats = counters.get(moduleKey);

        const key = plugin.getNaturalKey?.(payload) ?? null;
        if (key && (existing.has(key) || seen.has(key))) {
          stats.skipped++;
          continue;
        }
        await plugin.importHandler({
          payload,
          ctx: { moduleUserId: sid, mainKey },
        });
        if (key) {
          existing.add(key);
          seen.add(key);
        }
        stats.created++;
      }

      const parts = [];
      for (const [k, { created, skipped }] of counters.entries()) {
        parts.push(`${k}: ${created} ajout(s), ${skipped} doublon(s)`);
      }
      setSuccess(
        `Import terminé${parts.length ? ` (${parts.join(" ; ")})` : ""}.`,
      );
      finish(inputEl);
    } catch (err) {
      setError("Erreur lors de l'import NDJSON : " + (err?.message || ""));
      finish(inputEl);
    }
  }

  async function handleImport(evt) {
    const inputEl = evt?.target;
    const file = inputEl?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!ready) throw new Error("Clé de chiffrement absente.");
      const text = await file.text();
      const trimmed = text.trim();

      if (trimmed.startsWith("{")) {
        await importRootJson(JSON.parse(trimmed), inputEl);
      } else if (trimmed.startsWith("[")) {
        await importLegacyArray(JSON.parse(trimmed), inputEl);
      } else {
        await importNdjson(trimmed, inputEl);
      }
    } catch (err) {
      setError("Erreur lors de l'import : " + (err?.message || ""));
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
          <Button type="button" as="label" variant="info" className="disabled:opacity-50">
            Sélectionner le fichier
            <input
              id="import-json"
              type="file"
              accept="application/json,.json,.ndjson"
              onChange={handleImport}
              className="hidden"
              disabled={loading}
            />
          </Button>
        </div>
        {loading ? (
          <span className="text-sm ml-2 opacity-70 w-full text-center">
            Import en cours…
          </span>
        ) : null}
        {success ? <StatusBanner tone="success">{success}</StatusBanner> : null}
        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
      </form>
    </AccountSettingsCard>
  );
}
