import Modal from '@/ui/atoms/base/Modal';
import Button from '@/ui/atoms/base/Button';
import ModulesManager from '@/app/flow/Settings/components/ModulesManager';
import LanguageSelector from '@/ui/atoms/specifics/LanguageSelector';
import ThemeSelector from '@/ui/atoms/specifics/ThemeSelector';
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

  const sectionHeading =
    'text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <Modal
      open={open}
      onClose={null}
      backdropClass="bg-black/30 backdrop-blur-sm"
      className="w-full max-w-4xl"
    >
      <div className="flex flex-col gap-4 text-left">
        <header className="space-y-1 text-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{title}</h2>
          <p className="text-sm text-gray-600 dark:text-slate-300">{subtitle}</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="flex items-center justify-between gap-3">
            <h3 className={sectionHeading}>
              {t('modals.onboarding.sections.language')}
            </h3>
            <LanguageSelector />
          </section>

          <section className="flex items-center justify-between gap-3">
            <h3 className={sectionHeading}>
              {t('modals.onboarding.sections.theme')}
            </h3>
            <ThemeSelector variant="card" />
          </section>
        </div>

        <section className="space-y-2">
          <h3 className={sectionHeading}>
            {t('modals.onboarding.sections.modules')}
          </h3>
          <ModulesManager layout="table" />
        </section>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          {onClose ? (
            <Button variant="ghost" onClick={onClose}>
              {t('modals.onboarding.actions.close')}
            </Button>
          ) : null}
          {onSnooze ? (
            <Button
              variant="secondary"
              onClick={() => {
                void onSnooze();
              }}
            >
              {t('modals.onboarding.actions.snooze')}
            </Button>
          ) : null}
          <Button
            variant="info"
            className="px-6"
            disabled={enabledCount === 0}
            onClick={() => {
              void onFinish?.();
            }}
          >
            {t('modals.onboarding.actions.finish')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
