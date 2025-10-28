// frontend/src/features/Settings/components/ModulesManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
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
import Surface from "@/ui/atoms/layout/Surface.jsx";
import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";
import Badge from "@/ui/atoms/feedback/Badge.jsx";

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
      <Surface tone="muted" border="default" padding="md">
        <p className="text-sm text-[var(--text-muted)]">
          {t("settings.modules.none")}
        </p>
      </Surface>
    );
  }

  return (
    <Surface
      tone="muted"
      border="default"
      padding="lg"
      shadow="none"
      className="space-y-4"
    >
      {rows.map((m) => {
        const entry = getModuleEntry(cfg, m.id);
        const checked = !!entry?.enabled;
        const isBusy = busy === m.id;
        const label = t(m.label, { defaultValue: m.label });
        const description = m.description
          ? t(m.description, { defaultValue: m.description })
          : "";

        const badgeTone = checked ? "success" : "neutral";
        const badgeLabel = checked
          ? t("settings.modules.badges.active")
          : t("settings.modules.badges.inactive");

        return (
          <SurfaceCard
            as="label"
            key={m.id}
            tone="base"
            border="default"
            padding="md"
            interactive
            className="cursor-pointer"
            bodyClassName="flex flex-col gap-4 text-left sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1 sm:max-w-lg">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {label}
              </p>
              {description ? (
                <p className="text-sm text-[var(--text-muted)]">{description}</p>
              ) : null}
            </div>

            <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Badge tone={badgeTone}>{badgeLabel}</Badge>
              <div
                className={clsx(
                  "relative inline-flex h-6 w-11 shrink-0 items-center",
                  isBusy && "pointer-events-none opacity-60"
                )}
              >
                <span
                  className={clsx(
                    "absolute inset-0 rounded-full transition-colors duration-150 ease-out",
                    checked
                      ? "bg-[var(--accent-primary-strong)]"
                      : "bg-[var(--border-default)]"
                  )}
                  aria-hidden="true"
                />
                <span
                  className={clsx(
                    "absolute left-0 top-0 h-6 w-6 rounded-full border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-xs)] transition-transform duration-150 ease-out",
                    checked ? "translate-x-5" : ""
                  )}
                  aria-hidden="true"
                />
                <input
                  name={`module_${m.id}`}
                  type="checkbox"
                  aria-label={t("settings.modules.toggle", { module: label })}
                  className="absolute inset-0 cursor-pointer appearance-none focus:outline-hidden"
                  checked={checked}
                  onChange={(e) => toggleModule(m.id, e.target.checked)}
                  disabled={isBusy}
                />
              </div>
            </div>
          </SurfaceCard>
        );
      })}
      {error ? (
        <div className="text-sm text-[var(--accent-danger)]">{error}</div>
      ) : null}
    </Surface>
  );
}
