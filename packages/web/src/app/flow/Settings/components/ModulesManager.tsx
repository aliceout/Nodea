import { useMemo, useState } from 'react';
import clsx from 'clsx';
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
import { cn } from '@/lib/utils';

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
      <p className="border-b border-hair py-6 text-[13px] italic text-muted">
        {t('settings.modules.none', { defaultValue: 'Aucun module configurable.' })}
      </p>
    );
  }

  function Toggle({ checked, isBusy, onChange, label, variant = 'legacy' }: {
    checked: boolean;
    isBusy: boolean;
    onChange: (next: boolean) => void;
    label: string;
    variant?: 'legacy' | 'k';
  }) {
    const isK = variant === 'k';
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
            isK
              ? checked
                ? 'bg-accent'
                : 'bg-hair'
              : checked
                ? 'bg-emerald-500'
                : 'bg-slate-300',
          )}
        />
        <span
          aria-hidden="true"
          className={clsx(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full transition-transform duration-150 ease-out',
            isK ? 'border border-hair bg-bg' : 'border bg-white shadow',
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
    <div className="flex flex-col">
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
            className="group flex cursor-pointer items-center gap-4 border-b border-hair py-3.5 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-[14px] font-medium transition-colors',
                  checked ? 'text-ink' : 'text-ink-soft',
                )}
              >
                {label}
              </p>
              {description ? (
                <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>
              ) : null}
            </div>

            <Toggle
              checked={checked}
              isBusy={isBusy}
              onChange={(next) => toggleModule(m.id, next)}
              label={label}
              variant="k"
            />
          </label>
        );
      })}
      {error ? (
        <p
          role="alert"
          className="mt-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
