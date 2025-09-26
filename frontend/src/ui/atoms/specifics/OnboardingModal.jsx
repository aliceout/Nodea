import React from "react";

/**
 * Props:
 * - open: bool — affiche/masque la modale
 * - variant: "initial" | "update" — texte d’intro selon onboarding_version
 * - onClose: () => void — fermeture locale (si besoin)
 * - onFinish: () => Promise<void> — action “Terminer” (patch users.onboarding_status/version)
 * - onSnooze?: (isoDate?: string) => Promise<void> — action “Plus tard” (optionnel)
 *
 * Note: on ne touche pas au style ; on conserve la structure existante.
 */
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
    variant === "update" ? "Mise à jour de l’onboarding" : "Bienvenue !";
  const subtitle =
    variant === "update"
      ? "Nous avons simplifié l’onboarding. Vérifie tes réglages et confirme pour continuer."
      : "Choisissez au moins un module à activer pour commencer à utiliser Nodea.";

  const handleFinish = async () => {
    // L’UI reste identique ; on délègue la MAJ serveur au parent
    await onFinish?.();
  };

  const handleSnooze = async () => {
    // Optionnel : le parent peut décider quoi faire (date ISO, etc.)
    await onSnooze?.();
  };

  return (
    <Modal
      open={open}
      onClose={null} // modale volontairement non-fermant via backdrop, comme avant
      backdropClass="bg-black/30 backdrop-blur-sm"
      className="max-w-xl"
    >
      <div className="p-6 flex flex-col gap-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2 text-center">
          {title}
        </h2>

        <p className="text-base text-gray-600 text-center mb-4">{subtitle}</p>

        <ModulesManager />

        <div className="mt-2 flex items-center justify-center gap-3">
          {/* Terminer = active si au moins un module (même logique qu’avant) */}
          <button
            className="mt-4 bg-nodea-sky-dark text-white px-6 py-2 rounded font-semibold disabled:opacity-50"
            disabled={enabled.length === 0}
            onClick={handleFinish}
          >
            Terminer
          </button>

          {/* Plus tard = optionnel, affiché seulement si fourni */}
          {typeof onSnooze === "function" ? (
            <button
              className="mt-4 px-4 py-2 rounded font-semibold text-gray-600 border border-gray-300 hover:bg-gray-50"
              onClick={handleSnooze}
            >
              Plus tard
            </button>
          ) : null}

          {/* onClose reste disponible si tu veux garder un bouton local côté parent */}
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

import Modal from "@/ui/atoms/base/Modal";
import ModulesManager from "@/app/flow/Settings/components/ModulesManager";
import { useModulesRuntime, enabledModules } from "@/core/store/modulesRuntime";
