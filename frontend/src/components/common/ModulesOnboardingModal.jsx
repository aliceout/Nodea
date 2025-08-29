import React from "react";
import Modal from "@/components/common/Modal";
import ModulesManager from "@/modules/Settings/components/ModulesManager";
import { useModulesRuntime, enabledModules } from "@/store/modulesRuntime";

export default function ModulesOnboardingModal({ open, onClose }) {
  const modulesRuntime = useModulesRuntime();
  const enabled = enabledModules(modulesRuntime);

  return (
    <Modal open={open} onClose={null} backdropClass="bg-black/30 backdrop-blur-sm" className="max-w-lg">
      <div className="p-6 flex flex-col gap-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2 text-center">Bienvenue !</h2>
        <p className="text-base text-gray-600 text-center mb-4">
          Choisissez au moins un module à activer pour commencer à utiliser Nodea.
        </p>
        <ModulesManager />
        <button
          className="mt-4 bg-nodea-sky-dark text-white px-6 py-2 rounded font-semibold disabled:opacity-50"
          disabled={enabled.length === 0}
          onClick={onClose}
        >
          Continuer
        </button>
      </div>
    </Modal>
  );
}
