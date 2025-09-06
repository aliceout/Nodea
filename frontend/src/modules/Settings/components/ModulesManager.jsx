// frontend/src/modules/Settings/components/ModulesManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import { MODULES } from "@/config/modules_list";
import {
  loadModulesConfig,
  saveModulesConfig,
  getModuleEntry,
  setModuleEntry,
} from "@/services/modules-config";
import { generateModuleUserId, makeGuard } from "@/services/crypto-utils";
import pb from "@/services/pocketbase";
import { useStore } from "@/store/StoreProvider";

// ⬇️ nouvel import
import { setModulesState } from "@/store/modulesRuntime";

export default function ModulesManager() {
  const { mainKey } = useStore();
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const rows = useMemo(
    () => MODULES.filter((m) => m.to_toggle === true && !!m.id),
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const user = pb?.authStore?.model;
        if (!user) throw new Error("Utilisateur non connecté");

        const c = await loadModulesConfig(pb, user.id, mainKey); // déchiffré
        let nextCfg = c || {};

        // seed par défaut: tout activé
        for (const m of rows) {
          const entry = getModuleEntry(nextCfg, m.id);
          if (!entry) {
            nextCfg = setModuleEntry(nextCfg, m.id, {
              enabled: true,
              module_user_id: generateModuleUserId("g_"),
              delete_secret: makeGuard(),
              algo: "v1",
            });
          }
        }

        if (JSON.stringify(nextCfg) !== JSON.stringify(c || {})) {
          await saveModulesConfig(pb, user.id, mainKey, nextCfg);
        }

        if (mounted) {
          setCfg(nextCfg);
          // ⬇️ alimente le store runtime à l’ouverture de la page
          setModulesState(nextCfg);
          setLoading(false);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.warn(e);
        if (mounted) {
          setError("Impossible de charger vos réglages.");
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [mainKey, rows]);

  if (loading) return <div>Chargement…</div>;

  const toggleModule = async (moduleId, nextEnabled) => {
    setBusy(moduleId);
    setError("");
    try {
      const current = getModuleEntry(cfg, moduleId) || {
        enabled: true,
        module_user_id: generateModuleUserId("g_"),
        delete_secret: makeGuard(),
        algo: "v1",
      };

      const next = {
        ...current,
        enabled: nextEnabled,
        module_user_id:
          current.module_user_id ||
          (nextEnabled ? generateModuleUserId("g_") : null),
        delete_secret: current.delete_secret || makeGuard(),
      };

      const updated = setModuleEntry(cfg, moduleId, next);
      const user = pb?.authStore?.model;

      await saveModulesConfig(pb, user.id, mainKey, updated);

      // ⬇️ maj store runtime après save
      setModulesState(updated);

      setCfg(updated);
    } catch (e) {
      if (import.meta.env.DEV) console.warn(e);
      setError("Impossible d’enregistrer vos réglages.");
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="text-sm text-gray-600">
        Aucun module n’est actuellement configurable.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((m) => {
        const entry = getModuleEntry(cfg, m.id);
        const checked = !!entry?.enabled;
        const isBusy = busy === m.id;

        return (
          <label
            key={m.id}
            className="flex items-start justify-between rounded-lg border border-gray-200 p-4"
          >
            <div className="pr-4 text-left">
              <div className="text-sm font-medium text-gray-900">{m.label}</div>
              {m.description ? (
                <div className="mt-1 text-sm text-gray-600">
                  {m.description}
                </div>
              ) : null}
            </div>

            {/* --- TOGGLE (remplace l'input checkbox) --- */}
            <div
              className={[
                "relative inline-flex h-5 w-10 shrink-0 items-center justify-center rounded-full",
                busy === m.id ? "opacity-50 pointer-events-none" : "",
              ].join(" ")}
            >
              {/* rail */}
              <span
                className={[
                  "absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out",
                  checked
                    ? "bg-nodea-sky-darker " // bleu en clair ET en sombre
                    : "bg-gray-200 dark:bg-gray-800/50", // gris en clair ET en sombre
                ].join(" ")}
                aria-hidden="true"
              />
              {/* thumb */}
              <span
                className={[
                  "absolute left-0 size-5 rounded-full border border-gray-300 bg-white shadow-xs transition-transform duration-200 ease-in-out",
                  checked ? "translate-x-5" : "",
                  "dark:shadow-none",
                ].join(" ")}
                aria-hidden="true"
              />
              {/* input accessible */}
              <input
                name={`module_${m.id}`}
                type="checkbox"
                aria-label={`Activer ${m.label}`}
                className="absolute inset-0 appearance-none cursor-pointer focus:outline-hidden"
                checked={checked}
                onChange={(e) => toggleModule(m.id, e.target.checked)}
                disabled={busy === m.id}
              />
            </div>
          </label>
        );
      })}
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
