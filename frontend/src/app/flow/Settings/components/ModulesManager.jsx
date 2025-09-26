// frontend/src/features/Settings/components/ModulesManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import { MODULES } from "@/app/config/modules_list";
import {
  loadModulesConfig,
  saveModulesConfig,
  getModuleEntry,
  setModuleEntry,
} from "@/core/api/modules-config";
import { generateModuleUserId, makeGuard } from "@/core/crypto/crypto-utils";
import pb from "@/core/api/pocketbase";
import { KeyMissingError } from "@/core/crypto/webcrypto";
import { useStore } from "@/core/store/StoreProvider";

// ⬇️ nouvel import
import { setModulesState } from "@/core/store/modulesRuntime";

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

        const c = await loadModulesConfig(pb, user.id, mainKey); // déchiffré ou {}
        let nextCfg = c && typeof c === "object" ? c : {};

        if (mounted) {
          setCfg(nextCfg);
          if (Object.keys(nextCfg).length > 0) setModulesState(nextCfg);
          if (import.meta?.env?.DEV) {
            const summary = Object.fromEntries(
              Object.entries(nextCfg || {}).map(([k, v]) => [
                k,
                {
                  enabled: !!v?.enabled,
                  module_user_id: v?.module_user_id || null,
                },
              ])
            );
            console.log("[ModulesManager] Init config (DEV)", summary);
          }
          setLoading(false);
        }
      } catch (e) {
        if (e instanceof KeyMissingError) {
          if (mounted) {
            setError(
              "Clé absente: reconnectez-vous pour déchiffrer vos réglages."
            );
            setLoading(false);
          }
          return;
        }
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
      if (!mainKey) {
        throw new Error(
          "Clé de chiffrement absente. Reconnectez-vous avant de modifier les modules."
        );
      }
      const current = getModuleEntry(cfg, moduleId) || null;
      const willEnable = !!nextEnabled;

      const next = current
        ? {
            ...current,
            enabled: willEnable,
            module_user_id:
              current.module_user_id ||
              (willEnable ? generateModuleUserId("g_") : null),
            delete_secret: current.delete_secret || makeGuard(),
          }
        : willEnable
        ? {
            enabled: true,
            module_user_id: generateModuleUserId("g_"),
            delete_secret: makeGuard(),
            algo: "v1",
          }
        : { enabled: false };

      const updated = setModuleEntry(cfg, moduleId, next);
      const user = pb?.authStore?.model;

      await saveModulesConfig(pb, user.id, mainKey, updated);

      setModulesState(updated);
      setCfg(updated);
      if (import.meta?.env?.DEV) {
        const entry = updated[moduleId];
        console.log("[ModulesManager] Toggle (DEV)", moduleId, {
          enabled: !!entry?.enabled,
          module_user_id: entry?.module_user_id || null,
        });
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn(e);
      setError(e?.message || "Impossible d’enregistrer vos réglages.");
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
