import Modal from '@/ui/atoms/base/Modal';
import Button from '@/ui/atoms/base/Button';
import ModulesManager from '@/app/flow/Settings/components/ModulesManager';
import LanguagePreferences from '@/app/flow/Settings/components/LanguagePreferences';
import ThemePreferences from '@/app/flow/Settings/components/ThemePreferences';
import {
  useNodeaStore,
  selectEnabledModuleCount,
} from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';

type Variant = 'initial' | 'update';

interface OnboardingModalProps {
  open: boolean;
  variant?: Variant;
  onFinish?: () => Promise<void> | void;
  onSnooze?: () => Promise<void> | void;
  onClose?: () => void;
}

/**
 * First-run onboarding overlay. Restored from commit `aad487c^`.
 *
 * Rewired to `useNodeaStore` (the legacy `modulesRuntime` singleton is
 * gone). Module toggles and preference changes flow through their own
 * existing TSX components; this modal just frames them and exposes a
 * "Terminer" action that flips `users.onboarding_status` to
 * `complete` via `POST /auth/onboarding/complete`.
 *
 * Finish is gated on at least one module being enabled — same policy as
 * the legacy, to avoid landing on an empty home.
 */
export default function OnboardingModal({
  open,
  variant = 'initial',
  onFinish,
  onSnooze,
  onClose,
}: OnboardingModalProps) {
  const { t } = useI18n();
  const enabledCount = useNodeaStore(selectEnabledModuleCount);

  const title =
    variant === 'update'
      ? t('modals.onboarding.titleUpdate')
      : t('modals.onboarding.titleInitial');
  const subtitle =
    variant === 'update'
      ? t('modals.onboarding.subtitleUpdate')
      : t('modals.onboarding.subtitleInitial');

  return (
    <Modal
      open={open}
      onClose={null}
      backdropClass="bg-black/30 backdrop-blur-sm"
      className="w-full max-w-3xl sm:max-w-4xl"
    >
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <h2 className="text-center text-lg font-bold text-gray-900 dark:text-slate-100">
          {title}
        </h2>

        <p className="text-center text-base text-gray-600 dark:text-slate-300">
          {subtitle}
        </p>

        <section className="space-y-3">
          <h3 className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('modals.onboarding.sections.language')}
          </h3>
          <LanguagePreferences />
        </section>

        <section className="space-y-3">
          <h3 className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('modals.onboarding.sections.theme')}
          </h3>
          <ThemePreferences />
        </section>

        <section className="space-y-3">
          <h3 className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('modals.onboarding.sections.modules')}
          </h3>
          <ModulesManager />
        </section>

        <div className="mt-2 flex items-center justify-center gap-3">
          <Button
            variant="info"
            className="mt-4 px-6"
            disabled={enabledCount === 0}
            onClick={() => {
              void onFinish?.();
            }}
          >
            {t('modals.onboarding.actions.finish')}
          </Button>

          {onSnooze ? (
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => {
                void onSnooze();
              }}
            >
              {t('modals.onboarding.actions.snooze')}
            </Button>
          ) : null}

          {onClose ? (
            <Button variant="ghost" className="mt-4" onClick={onClose}>
              {t('modals.onboarding.actions.close')}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
