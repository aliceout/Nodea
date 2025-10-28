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
import { useI18n } from "@/i18n/I18nProvider.jsx";
import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";

// �������<���? nouvel import
import { setModulesState } from "@/core/store/modulesRuntime";

export default function ModulesManager() {
  const { mainKey } = useStore();
  const { t } = useI18n();
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
        const nextCfg = c && typeof c === "object" ? c : {};

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
            setError(t("settings.modules.errors.missingKey"));
            setLoading(false);
          }
          return;
        }
        if (import.meta.env.DEV) console.warn(e);
        if (mounted) {
          setError(t("settings.modules.errors.loadFailed"));
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [mainKey, rows]);

  if (loading) {
    return (
      <div className="text-sm text-gray-600">
        {t("settings.modules.loading")}
      </div>
    );
  }

  const toggleModule = async (moduleId, nextEnabled) => {
    setBusy(moduleId);
    setError("");
    try {
      if (!mainKey) {
        throw new Error(t("settings.modules.errors.keyMissingAction"));
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
      setError(e?.message || t("settings.modules.errors.saveFailed"));
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="text-sm text-gray-600">
        {t("settings.modules.none")}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/60 p-4 sm:p-6 space-y-4">
      <p className="text-sm text-gray-600">
        {t("settings.modules.description")}
      </p>
      {rows.map((m) => {
        const entry = getModuleEntry(cfg, m.id);
        const checked = !!entry?.enabled;
        const isBusy = busy === m.id;
        const label = t(m.label, { defaultValue: m.label });
        const description = m.description
          ? t(m.description, { defaultValue: m.description })
          : "";

        return (
          <SurfaceCard
            as="label"
            key={m.id}
            className="cursor-pointer p-4 sm:p-5"
            bodyClassName="flex flex-col gap-4 text-left sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1 sm:max-w-lg">
              <p className="text-sm font-semibold text-slate-900">{label}</p>
              {description ? (
                <p className="text-sm text-slate-600">{description}</p>
              ) : null}
            </div>

            <div
              className={[
                "relative inline-flex h-5 w-10 shrink-0 items-center justify-center rounded-full",
                isBusy ? "pointer-events-none opacity-50" : "",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out",
                  checked
                    ? "bg-nodea-sky-darker "
                    : "bg-gray-200 dark:bg-gray-800/50",
                ].join(" ")}
                aria-hidden="true"
              />
              <span
                className={[
                  "absolute left-0 size-5 rounded-full border border-gray-300 bg-white shadow-xs transition-transform duration-200 ease-in-out",
                  checked ? "translate-x-5" : "",
                  "dark:shadow-none",
                ].join(" ")}
                aria-hidden="true"
              />
              <input
                name={`module_${m.id}`}
                type="checkbox"
                aria-label={t("settings.modules.toggle", { module: label })}
                className="absolute inset-0 appearance-none cursor-pointer focus:outline-hidden"
                checked={checked}
                onChange={(e) => toggleModule(m.id, e.target.checked)}
                disabled={isBusy}
              />
            </div>
          </SurfaceCard>
        );
      })}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
