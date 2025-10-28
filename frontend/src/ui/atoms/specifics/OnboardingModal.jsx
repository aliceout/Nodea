import Modal from "@/ui/atoms/base/Modal";
import ModulesManager from "@/app/flow/Settings/components/ModulesManager";
import LanguagePreferences from "@/app/flow/Settings/components/LanguagePreferences";
import ThemePreferences from "@/app/flow/Settings/components/ThemePreferences";
import { useModulesRuntime, enabledModules } from "@/core/store/modulesRuntime";
import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function OnboardingModal({
  open,
  variant = "initial",
  onClose,
  onFinish,
  onSnooze,
}) {
  const modulesRuntime = useModulesRuntime();
  const enabled = enabledModules(modulesRuntime);
  const { t } = useI18n();

  const title =
    variant === "update"
      ? t("modals.onboarding.titleUpdate")
      : t("modals.onboarding.titleInitial");
  const subtitle =
    variant === "update"
      ? t("modals.onboarding.subtitleUpdate")
      : t("modals.onboarding.subtitleInitial");

  const handleFinish = async () => {
    await onFinish?.();
  };

  const handleSnooze = async () => {
    await onSnooze?.();
  };

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
            {t("modals.onboarding.sections.language")}
          </h3>
          <LanguagePreferences />
        </section>

        <section className="space-y-3">
          <h3 className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t("modals.onboarding.sections.theme")}
          </h3>
          <ThemePreferences />
        </section>

        <section className="space-y-3">
          <h3 className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t("modals.onboarding.sections.modules")}
          </h3>
          <ModulesManager />
        </section>

        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            className="mt-4 rounded bg-nodea-sky-dark px-6 py-2 font-semibold text-white transition-colors disabled:opacity-50 dark:bg-slate-600"
            disabled={enabled.length === 0}
            onClick={handleFinish}
          >
            {t("modals.onboarding.actions.finish")}
          </button>

          {typeof onSnooze === "function" ? (
            <button
              className="mt-4 rounded border border-gray-300 px-4 py-2 font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={handleSnooze}
            >
              {t("modals.onboarding.actions.snooze")}
            </button>
          ) : null}

          {typeof onClose === "function" ? (
            <button
              className="mt-4 rounded px-4 py-2 font-semibold text-gray-500 transition-colors hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={onClose}
            >
              {t("modals.onboarding.actions.close")}
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
