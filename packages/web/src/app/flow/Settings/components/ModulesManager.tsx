import { useMemo, useState } from 'react';
import clsx from 'clsx';
import Surface from '@/ui/atoms/layout/Surface';
import SurfaceCard from '@/ui/atoms/specifics/SurfaceCard';
import Badge from '@/ui/atoms/feedback/Badge';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { MODULES } from '@/app/config/modules_list';
import { saveEncryptedModulesConfig } from '@/core/api/modules-config-client';
import { generateModuleUserId } from '@/core/crypto/ids';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
  type ModuleRuntimeEntry,
  type ModulesRuntime,
} from '@/core/store/nodea-store';

export interface ModulesManagerProps {
  /**
   * `cards` (default) — one full Surface card per module, used on the
   *   Settings page where we have room to breathe.
   * `table` — dense grid (label · description · toggle) suitable for
   *   cramped containers like the onboarding modal.
   */
  layout?: 'cards' | 'table';
}

/**
 * ModulesManager (TSX).
 *
 * Toggles a module on/off by updating the user-scoped, encrypted
 * `modules_config` blob on the new back. On enable, a fresh
 * `moduleUserId` is generated — the opaque per-module sid used as the
 * `sid=` query parameter on every encrypted-entry route.
 *
 * The Zustand `modules` slice is hydrated once per session by
 * `useModulesHydration` (mounted in `Layout`), so this component reads
 * straight from the store and only writes back on toggle.
 */
export default function ModulesManager({ layout = 'cards' }: ModulesManagerProps = {}) {
  const { t } = useI18n();
  const mainKey = useNodeaStore(selectMainKey);
  const cfg = useNodeaStore(selectModules);
  const setModulesStore = useNodeaStore((s) => s.setModules);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    mainKey
      ? null
      : t('settings.modules.errors.missingKey', {
          defaultValue: 'Clé principale absente — reconnecte-toi.',
        }),
  );

  const rows = useMemo(
    () => MODULES.filter((m) => m.to_toggle === true && !!m.id),
    [],
  );

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

  if (rows.length === 0) {
    return (
      <Surface tone="muted" border="default" padding="md">
        <p className="text-sm">
          {t('settings.modules.none', { defaultValue: 'Aucun module configurable.' })}
        </p>
      </Surface>
    );
  }

  function Toggle({ checked, isBusy, onChange, label }: {
    checked: boolean;
    isBusy: boolean;
    onChange: (next: boolean) => void;
    label: string;
  }) {
    return (
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
          onChange={(e) => onChange(e.target.checked)}
          disabled={isBusy}
        />
      </div>
    );
  }

  if (layout === 'table') {
    return (
      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        {rows.map((m) => {
          const entry = cfg[m.id];
          const checked = !!entry?.enabled;
          const isBusy = busy === m.id;
          const label = t(m.label, { defaultValue: m.label });
          const description = m.description
            ? t(m.description, { defaultValue: m.description })
            : '';
          return (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{label}</p>
                {description ? (
                  <p className="truncate text-xs opacity-70">{description}</p>
                ) : null}
              </div>
              <Toggle
                checked={checked}
                isBusy={isBusy}
                onChange={(next) => toggleModule(m.id, next)}
                label={label}
              />
            </label>
          );
        })}
        {error ? <div className="px-3 py-2 text-xs text-red-600">{error}</div> : null}
      </div>
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
              <Toggle
                checked={checked}
                isBusy={isBusy}
                onChange={(next) => toggleModule(m.id, next)}
                label={label}
              />
            </div>
          </SurfaceCard>
        );
      })}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </Surface>
  );
}
