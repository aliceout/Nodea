import { useMemo, useState, type ComponentType } from 'react';
import clsx from 'clsx';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { MODULES } from '@/app/modules-registry';
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
import EmptyHint from '@/ui/dirk/module/EmptyHint';

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
 *
 * Visual language is aligned with the inline onboarding picker
 * (`app/flow/Homepage/Onboarding.tsx`): same heroicon at the start of
 * each row, same toggle widget chrome, same accent treatment for the
 * active state — but rendered as a dense list rather than a card grid
 * because Settings is a maintenance surface (efficiency) where
 * onboarding is a deliberation surface (breathing).
 */
export default function ModulesManager() {
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
      <EmptyHint>
        {t('settings.modules.none', { defaultValue: 'Aucun module configurable.' })}
      </EmptyHint>
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
            checked ? 'bg-accent' : 'bg-hair',
          )}
        />
        <span
          aria-hidden="true"
          className={clsx(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full border border-hair bg-bg transition-transform duration-150 ease-out',
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

  return (
    <div className="flex flex-col">
      {rows.map((m) => {
        const entry = cfg[m.id];
        const checked = !!entry?.enabled;
        const isBusy = busy === m.id;
        const Icon = m.icon as ComponentType<{ className?: string }>;
        const label = t(m.label, { defaultValue: m.label });
        const description = m.description
          ? t(m.description, { defaultValue: m.description })
          : '';

        return (
          <label
            key={m.id}
            className="group flex cursor-pointer items-center gap-3 border-b border-hair py-3.5 last:border-b-0"
          >
            {/* Heroicon — same set as the sidebar nav and the
                onboarding cards, so the visual identity stays
                consistent across the app surface. Active state
                flips to bg-accent / white so the row carries an
                unmistakable cue at a glance, no need to read the
                toggle widget on the right. */}
            <span
              aria-hidden="true"
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
                checked ? 'bg-accent text-white' : 'bg-bg-2 text-ink-soft',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>

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
