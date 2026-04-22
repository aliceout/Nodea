import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import Surface from '@/ui/atoms/layout/Surface';
import SurfaceCard from '@/ui/atoms/specifics/SurfaceCard';
import Badge from '@/ui/atoms/feedback/Badge';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { MODULES } from '@/app/config/modules_list';
import {
  loadDecryptedModulesConfig,
  saveEncryptedModulesConfig,
} from '@/core/api/modules-config-client';
import { generateModuleUserId } from '@/core/crypto/ids';
import {
  useNodeaStore,
  selectMainKey,
  type ModuleRuntimeEntry,
  type ModulesRuntime,
} from '@/core/store/nodea-store';

/**
 * ModulesManager (TSX).
 *
 * Toggles a module on/off by updating the user-scoped, encrypted
 * `modules_config` blob on the new back. On enable, a fresh
 * `moduleUserId` is generated — the opaque per-module sid used as the
 * `sid=` query parameter on every encrypted-entry route.
 *
 * The Zustand `modules` slice is kept in sync so the rest of the app
 * (Homepage, flow router, module pages) sees enable/disable changes
 * immediately.
 *
 * Replaces the PB-driven ModulesManager.jsx which used
 * `loadModulesConfig(pb, userId, mainKey)` + a hand-rolled
 * `delete_secret`; that field was only ever written, never read, so
 * it is dropped here.
 */
export default function ModulesManager() {
  const { t } = useI18n();
  const mainKey = useNodeaStore(selectMainKey);
  const setModulesStore = useNodeaStore((s) => s.setModules);

  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<ModulesRuntime>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () => MODULES.filter((m) => m.to_toggle === true && !!m.id),
    [],
  );

  useEffect(() => {
    if (!mainKey) {
      setLoading(false);
      setError(
        t('settings.modules.errors.missingKey', {
          defaultValue: 'Clé principale absente — reconnecte-toi.',
        }),
      );
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const decrypted = await loadDecryptedModulesConfig(mainKey.aesKey);
        if (cancelled) return;
        setCfg(decrypted);
        setModulesStore(decrypted);
      } catch (err) {
        if (!cancelled) {
          setError(
            t('settings.modules.errors.loadFailed', {
              defaultValue: 'Échec du chargement des modules.',
            }),
          );
          if (import.meta.env.DEV) console.warn(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mainKey, setModulesStore, t]);

  async function toggleModule(moduleId: string, nextEnabled: boolean): Promise<void> {
    if (!mainKey) {
      setError(
        t('settings.modules.errors.keyMissingAction', {
          defaultValue: 'Clé principale absente — reconnecte-toi.',
        }),
      );
      return;
    }
    setBusy(moduleId);
    setError(null);
    try {
      const current = cfg[moduleId];
      const nextEntry: ModuleRuntimeEntry = nextEnabled
        ? {
            enabled: true,
            moduleUserId: current?.moduleUserId ?? generateModuleUserId(),
            algo: current?.algo ?? 'v1',
          }
        : {
            enabled: false,
            ...(current?.moduleUserId ? { moduleUserId: current.moduleUserId } : {}),
          };

      const updated: ModulesRuntime = { ...cfg, [moduleId]: nextEntry };
      await saveEncryptedModulesConfig(mainKey.aesKey, updated);
      setCfg(updated);
      setModulesStore(updated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('settings.modules.errors.saveFailed', {
              defaultValue: 'Échec de la sauvegarde.',
            }),
      );
      if (import.meta.env.DEV) console.warn(err);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-600">
        {t('settings.modules.loading', { defaultValue: 'Chargement…' })}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Surface tone="muted" border="default" padding="md">
        <p className="text-sm">
          {t('settings.modules.none', { defaultValue: 'Aucun module configurable.' })}
        </p>
      </Surface>
    );
  }

  return (
    <Surface tone="muted" border="default" padding="lg" shadow="none" className="space-y-4">
      {rows.map((m) => {
        const entry = cfg[m.id];
        const checked = !!entry?.enabled;
        const isBusy = busy === m.id;
        const label = t(m.label, { defaultValue: m.label });
        const description = m.description
          ? t(m.description, { defaultValue: m.description })
          : '';

        const badgeLabel = checked
          ? t('settings.modules.badges.active', { defaultValue: 'Actif' })
          : t('settings.modules.badges.inactive', { defaultValue: 'Inactif' });

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
              <p className="text-sm font-semibold">{label}</p>
              {description ? <p className="text-sm opacity-70">{description}</p> : null}
            </div>

            <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Badge tone={checked ? 'success' : 'neutral'}>{badgeLabel}</Badge>
              <div
                className={clsx(
                  'relative inline-flex h-6 w-11 shrink-0 items-center',
                  isBusy && 'pointer-events-none opacity-60',
                )}
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    'absolute inset-0 rounded-full transition-colors duration-150 ease-out',
                    checked ? 'bg-emerald-500' : 'bg-slate-300',
                  )}
                />
                <span
                  aria-hidden="true"
                  className={clsx(
                    'absolute left-0 top-0 h-6 w-6 rounded-full border bg-white shadow transition-transform duration-150 ease-out',
                    checked ? 'translate-x-5' : '',
                  )}
                />
                <input
                  type="checkbox"
                  aria-label={t('settings.modules.toggle', {
                    defaultValue: `Activer ${label}`,
                    module: label,
                  })}
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
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </Surface>
  );
}
