import { useMemo, useState, type ComponentType } from 'react';
import {
  apiCompleteOnboarding,
  apiMe,
} from '@/core/api/client';
import { saveEncryptedModulesConfig } from '@/core/api/modules-config-client';
import { generateModuleUserId } from '@/core/crypto/ids';
import { MODULES } from '@/app/config/modules_list';
import {
  useNodeaStore,
  selectMainKey,
  selectEnabledModuleCount,
  selectModules,
  type ModuleRuntimeEntry,
  type ModulesRuntime,
} from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import DirkButton from '@/ui/atoms/dirk/Button';
import { cn } from '@/lib/utils';

interface OnboardingProps {
  displayName: string;
}

/**
 * First-run onboarding — Direction K · Sauge, inline on the home page.
 *
 * Replaces the legacy modal pop-up. The first time a user lands
 * on Aujourd'hui, the central content surface becomes a generous
 * welcome + a card grid where each module is a deliberate choice
 * rather than a row in a settings list.
 *
 * Module cards carry the heroicon already used in the sidebar so
 * the visual identity transfers when the user starts navigating.
 * The whole card is the click target — toggling the switch widget
 * directly works too. Active modules get the accent border + a
 * subtle bg-2 wash; inactive cards stay neutral but lift on hover.
 *
 * Language picker is *not* shown here on purpose — it's already
 * available in the sidebar footer's `<LanguageToggle>`, and
 * duplicating it on this surface would scatter the same control
 * across the app. Theme follows the OS default and the sidebar
 * footer toggle as well.
 */
export default function Onboarding({ displayName }: OnboardingProps) {
  const { t } = useI18n();
  const mainKey = useNodeaStore(selectMainKey);
  const cfg = useNodeaStore(selectModules);
  const setModulesStore = useNodeaStore((s) => s.setModules);
  const enabledCount = useNodeaStore(selectEnabledModuleCount);
  const setAuth = useNodeaStore((s) => s.setAuth);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  async function finish(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      await apiCompleteOnboarding();
      const me = await apiMe();
      if (me) setAuth(me);
      // setAuth flips `onboardingStatus` to `complete` → the home
      // re-renders with the regular dashboard.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la validation.',
      );
      if (import.meta.env.DEV) console.warn('finish onboarding failed', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="animate-fade-up flex min-h-0 min-w-0 max-w-3xl flex-col">
      {/* Generous welcome — same typographic register as the auth
          pages' marketing panel. The user just signed up and
          activated their account; the inline onboarding ought to
          read as a continuation of that warmth, not a settings
          chore. */}
      <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">
        {displayName ? `Bienvenue, ${displayName}.` : 'Bienvenue.'}
      </h1>
      <div className="mt-3 mb-10 space-y-3 text-[15px] leading-[1.55] text-ink-soft">
        <p>
          Nodea, c’est un espace pour écrire, suivre tes humeurs, tes lectures, ce
          que tu vises — chacun à part, chiffré sur ton appareil.
        </p>
        <p>
          Choisis ce qui te parle, tu pourras revenir là-dessus à tout moment
          depuis « Mon compte ».
        </p>
      </div>

      <ul className="mb-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
            <li key={m.id}>
              <button
                type="button"
                onClick={() => void toggleModule(m.id, !checked)}
                disabled={isBusy}
                aria-pressed={checked}
                aria-label={`${checked ? 'Désactiver' : 'Activer'} ${label}`}
                className={cn(
                  'group relative flex h-full w-full cursor-pointer flex-col items-start gap-2 rounded-md border bg-bg p-4 text-left transition-[background,border-color,transform] duration-150',
                  checked
                    ? 'border-accent bg-accent/5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                    : 'border-hair hover:-translate-y-px hover:border-ink-soft hover:bg-bg-2/40',
                  isBusy && 'pointer-events-none opacity-60',
                )}
              >
                <span className="flex w-full items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
                      checked
                        ? 'bg-accent text-white'
                        : 'bg-bg-2 text-ink-soft group-hover:bg-bg-2',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-[14px] font-semibold tracking-[-0.005em]',
                        checked ? 'text-ink' : 'text-ink-soft',
                      )}
                    >
                      {label}
                    </span>
                    {description ? (
                      <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-muted">
                        {description}
                      </span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                      checked ? 'bg-accent' : 'bg-hair',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute left-0.5 top-0.5 h-4 w-4 rounded-full border border-hair bg-bg transition-transform',
                        checked && 'translate-x-4',
                      )}
                    />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p
          role="alert"
          className="mb-3 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[13px] text-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-hair pt-5">
        <span className="text-[12.5px] text-muted">
          {enabledCount === 0
            ? 'Choisis au moins un module pour démarrer.'
            : `${enabledCount} module${enabledCount === 1 ? '' : 's'} activé${enabledCount === 1 ? '' : 's'}.`}
        </span>
        <DirkButton
          variant="primary"
          onClick={() => void finish()}
          disabled={enabledCount === 0 || submitting}
          className="px-6"
        >
          {submitting
            ? 'Enregistrement…'
            : t('modals.onboarding.actions.finish', { defaultValue: 'Commencer' })}
        </DirkButton>
      </div>
    </section>
  );
}
