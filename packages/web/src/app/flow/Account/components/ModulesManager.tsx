import { useMemo, useState, type ComponentType } from 'react';
import clsx from 'clsx';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { MODULES } from '@/app/modules-registry';
import { isApiError } from '@/core/api/client';
import {
  loadDecryptedModulesConfig,
  saveEncryptedModulesConfig,
} from '@/core/api/modules-config-client';
import { freshenPasswordReauth } from '@/core/auth/opaque';
import { generateModuleUserId } from '@/core/crypto/ids';
import {
  MODULE_COLLECTIONS,
  PartialWipeError,
  wipeModule,
} from '@/core/modules/wipe-module';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
  type ModuleRuntimeEntry,
  type ModulesRuntime,
} from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import EmptyHint from '@/ui/dirk/module/EmptyHint';

import Field from './Field';

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
 * `WipePanel` and `Toggle` are module-level components ON PURPOSE
 * (audit 2026-06) : they used to be declared inside the parent's
 * body, so every parent re-render changed their identity and React
 * unmounted/remounted them — wiping the typed password and dropping
 * the « wiping » progress state mid-flight.
 *
 * Visual language is aligned with the inline onboarding picker
 * (`app/flow/Homepage/Onboarding.tsx`): same heroicon at the start of
 * each row, same toggle widget chrome, same accent treatment for the
 * active state — but rendered as a dense list rather than a card grid
 * because Settings is a maintenance surface (efficiency) where
 * onboarding is a deliberation surface (breathing).
 */

/** Map module id → store version bumps to fire after a successful
 *  wipe, so any mounted consumer refetches instead of showing stale
 *  rows. Modules absent here (habits / review / hrt) have no store
 *  version — their hooks refetch on every page mount, which is
 *  enough since Settings is a different surface. */
const WIPE_VERSION_BUMPS: Record<string, ReadonlyArray<string>> = {
  mood: ['bumpMoodVersion'],
  journal: ['bumpJournalVersion'],
  goals: ['bumpGoalsVersion'],
  library: ['bumpLibraryItemsVersion', 'bumpLibraryReviewsVersion'],
};

/** Inline destructive confirmation expanded under a module row.
 *  Owns the password re-auth + the wipe fan-out. Closes via
 *  `onClose` ; on success the relevant store versions are bumped so
 *  mounted consumers refetch. */
function WipePanel({
  moduleId,
  moduleLabel,
  sid,
  onClose,
}: {
  moduleId: string;
  moduleLabel: string;
  sid: string;
  onClose: () => void;
}) {
  const { t, tn } = useI18n();
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<'idle' | 'wiping' | 'done'>('idle');
  const [panelError, setPanelError] = useState<string | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);

  async function handleConfirm(): Promise<void> {
    setPanelError(null);
    if (!password) {
      setPanelError(
        t('settings.modules.wipe.passwordRequired', {
          defaultValue: 'Renseigne ton mot de passe pour confirmer.',
        }),
      );
      return;
    }
    setPhase('wiping');
    try {
      // Step 1 : OPAQUE re-auth round-trip — same posture as the
      // plaintext-export gate in `ExportPanel`. Stamps a fresh
      // `reauth_password_at` on the session so the wipe endpoint's
      // `requireFreshPassword` middleware lets the calls through
      // for the next 5 minutes.
      await freshenPasswordReauth(password);
      // Step 2 : fan out one POST /records/wipe per collection
      // the module owns. The server-side delete is one transaction
      // per call ; we let the helper iterate the list.
      const result = await wipeModule(moduleId, sid);
      setDeletedCount(result.deleted);
      setPassword('');
      // Refetch trigger for mounted consumers of this module's data.
      const state = useNodeaStore.getState() as unknown as Record<
        string,
        unknown
      >;
      for (const bump of WIPE_VERSION_BUMPS[moduleId] ?? []) {
        const fn = state[bump];
        if (typeof fn === 'function') (fn as () => void)();
      }
      setPhase('done');
    } catch (err) {
      setPhase('idle');
      if (isApiError(err) && err.status === 401) {
        setPanelError(
          t('settings.modules.wipe.wrongPassword', {
            defaultValue: 'Mot de passe incorrect.',
          }),
        );
      } else if (err instanceof PartialWipeError) {
        // Mid-list failure : say exactly what WAS wiped so the user
        // doesn't have to guess which data survived (audit 2026-06).
        const wiped = err.partial.map((p) => p.collection).join(', ');
        setPanelError(
          err.partial.length === 0
            ? t('settings.modules.wipe.failedNone', {
                defaultValue: 'Échec — aucune donnée n’a été supprimée.',
              })
            : t('settings.modules.wipe.failedPartial', {
                defaultValue: `Échec en cours de route. Déjà vidé : ${wiped}. Relance pour terminer.`,
                values: { wiped },
              }),
        );
        if (import.meta.env.DEV)
          console.warn('wipe module partial failure', moduleId, err);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setPanelError(msg);
        if (import.meta.env.DEV)
          console.warn('wipe module failed', moduleId, err);
      }
    }
  }

  if (phase === 'done') {
    return (
      <div
        role="status"
        className="border-t border-hair bg-bg-2/40 px-4 py-4 text-[13px] text-ink"
      >
        <p>
          {tn('settings.modules.wipe.done', deletedCount, {
            values: { module: moduleLabel },
          })}
        </p>
        <div className="mt-3">
          <Button variant="neutral" size="sm" onClick={onClose}>
            {t('common.actions.close', { defaultValue: 'Fermer' })}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby={`wipe-${moduleId}-title`}
      className="border-t border-danger/30 bg-danger/5 px-4 py-4"
    >
      <p
        id={`wipe-${moduleId}-title`}
        className="text-[13px] font-medium text-ink"
      >
        {t('settings.modules.wipe.title', {
          defaultValue: `Vider toutes les entrées de ${moduleLabel} ?`,
          values: { module: moduleLabel },
        })}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
        {t('settings.modules.wipe.description', {
          defaultValue:
            'Action irréversible. Le module reste activé mais toutes ses entrées chiffrées sont supprimées du serveur. Saisis ton mot de passe pour confirmer.',
        })}
      </p>
      <div className="mt-3 max-w-sm">
        <Field
          label={t('settings.modules.wipe.passwordLabel', {
            defaultValue: 'Mot de passe actuel',
          })}
          type="password"
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setPassword(e.target.value)
          }
          autoFocus
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={() => void handleConfirm()}
          disabled={phase === 'wiping' || password.length === 0}
        >
          {phase === 'wiping'
            ? t('settings.modules.wipe.wiping', {
                defaultValue: 'Suppression…',
              })
            : t('settings.modules.wipe.confirm', {
                defaultValue: 'Confirmer la suppression',
              })}
        </Button>
        <Button
          variant="neutral"
          size="sm"
          onClick={onClose}
          disabled={phase === 'wiping'}
        >
          {t('common.actions.cancel', { defaultValue: 'Annuler' })}
        </Button>
      </div>
      {panelError ? (
        <p role="alert" className="mt-3 text-[12.5px] text-danger">
          {panelError}
        </p>
      ) : null}
    </div>
  );
}

function Toggle({
  checked,
  isBusy,
  onChange,
  label,
}: {
  checked: boolean;
  isBusy: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  const { t } = useI18n();
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
          values: { module: label },
        })}
        className="absolute inset-0 cursor-pointer appearance-none focus:outline-hidden"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={isBusy}
      />
    </div>
  );
}

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
  /** Module id of the row whose « Vider toutes les entrées » panel
   *  is currently expanded. At most one expanded panel at a time so
   *  the destructive UI is hard to confuse with a sibling row. */
  const [wipeFor, setWipeFor] = useState<string | null>(null);

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
      // Read-modify-write against a FRESH copy of the stored config
      // (audit 2026-06 passe 2), never against the in-memory `cfg` :
      // if hydration failed, `cfg` is `{}` and writing it back would
      // destroy every `moduleUserId` — orphaning all encrypted data
      // of every module, irreversibly. Re-reading right before the
      // write also narrows the multi-device last-write-wins race.
      const fresh = await loadDecryptedModulesConfig(mainKey.aesKey);
      if (fresh === null) {
        // Blob present but unreadable — refuse to overwrite it.
        setError(
          t('settings.modules.errors.configUnreadable', {
            defaultValue:
              'Réglages des modules illisibles — reconnecte-toi avant de les modifier (ne pas écraser).',
          }),
        );
        return;
      }

      const current = fresh[moduleId];
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

      const updated: ModulesRuntime = { ...fresh, [moduleId]: nextEntry };
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
        // « Vider » only makes sense for modules that own
        // encrypted collections AND that the user has enabled
        // (otherwise there's no `moduleUserId` to scope the wipe
        // by, and an empty disabled-module wipe is a no-op).
        const canWipe = !!MODULE_COLLECTIONS[m.id] && !!entry?.moduleUserId;

        return (
          <div
            key={m.id}
            className="border-b border-hair last:border-b-0"
          >
            <label className="group flex cursor-pointer items-center gap-3 py-3.5">
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

              {canWipe ? (
                <button
                  type="button"
                  // Buttons nested inside a <label> don't toggle
                  // the wrapped input by default, but we still
                  // stopPropagation defensively so a future
                  // refactor of the row can't surprise the
                  // destructive affordance into firing the toggle.
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setWipeFor((cur) => (cur === m.id ? null : m.id));
                  }}
                  aria-expanded={wipeFor === m.id}
                  aria-label={t('settings.modules.wipe.open', {
                    defaultValue: `Vider toutes les entrées ${label}`,
                    values: { module: label },
                  })}
                  className={cn(
                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors',
                    'hover:bg-danger/10 hover:text-danger',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger',
                  )}
                >
                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </label>

            {wipeFor === m.id && entry?.moduleUserId ? (
              <WipePanel
                moduleId={m.id}
                moduleLabel={label}
                sid={entry.moduleUserId}
                onClose={() => setWipeFor(null)}
              />
            ) : null}
          </div>
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
