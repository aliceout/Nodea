import Modal from "@/ui/atoms/base/Modal";
import ModulesManager from "@/app/flow/Settings/components/ModulesManager";
import LanguagePreferences from "@/app/flow/Settings/components/LanguagePreferences";
import { useModulesRuntime, enabledModules } from "@/core/store/modulesRuntime";

export default function OnboardingModal({
  open,
  variant = "initial",
  onClose,
  onFinish,
  onSnooze,
}) {
  const modulesRuntime = useModulesRuntime();
  const enabled = enabledModules(modulesRuntime);

  const title =
    variant === "update" ? "Mise à jour de l'onboarding" : "Bienvenue !";
  const subtitle =
    variant === "update"
      ? "Nous avons simplifié l'onboarding. Vérifie tes réglages et confirme pour continuer."
      : "Choisissez au moins un module à activer pour commencer à utiliser Nodea.";

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
      <div className="p-6 sm:p-8 flex flex-col gap-6">
        <h2 className="text-lg font-bold text-gray-900 text-center">
          {title}
        </h2>

        <p className="text-base text-gray-600 text-center">{subtitle}</p>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 text-left">
            Langue
          </h3>
          <LanguagePreferences showStatus={false} />
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 text-left">
            Modules
          </h3>
          <ModulesManager />
        </section>

        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            className="mt-4 bg-nodea-sky-dark text-white px-6 py-2 rounded font-semibold disabled:opacity-50"
            disabled={enabled.length === 0}
            onClick={handleFinish}
          >
            Terminer
          </button>

          {typeof onSnooze === "function" ? (
            <button
              className="mt-4 px-4 py-2 rounded font-semibold text-gray-600 border border-gray-300 hover:bg-gray-50"
              onClick={handleSnooze}
            >
              Plus tard
            </button>
          ) : null}

          {typeof onClose === "function" ? (
            <button
              className="mt-4 px-4 py-2 rounded font-semibold text-gray-500 hover:bg-gray-100"
              onClick={onClose}
            >
              Fermer
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
