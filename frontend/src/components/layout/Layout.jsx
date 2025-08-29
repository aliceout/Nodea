import React from "react";

export default function Layout() {
  useBootstrapModulesRuntime();
  const { state, keyStatus, logout, mainKey } = useStore();
  const current = selectCurrentTab(state);
  const ActiveView = useMemo(() => {
    return nav.find((t) => t.id === current)?.element ?? null;
  }, [current]);
  const modulesRuntime = useModulesRuntime();
  const enabled = enabledModules(modulesRuntime);
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // Ajoute un délai pour éviter le flash de la modale au login
    let timer = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    // Attendre que la clé soit présente avant de vérifier les modules activés
    if (!mainKey) return;
    if (enabled.length === 0) setShowOnboarding(true);
    // Ne pas fermer la modale automatiquement si un module est activé
    // La fermeture se fait uniquement sur le bouton "Continuer" dans la modale
  }, [enabled.length, ready, mainKey]);

  return (
    <div className="min-h-screen bg-slate-50 flex ">
      {keyStatus === "missing" && <KeyMissingModal onLogout={logout} />}
      {keyStatus !== "missing" && showOnboarding && ready && (
        <ModulesOnboardingModal
          open={true}
          onClose={() => setShowOnboarding(false)}
        />
      )}
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex-1 bg-white">{ActiveView}</main>
      </div>
    </div>
  );
}

import KeyMissingModal from "@/components/shared/KeyMissingModal";
import ModulesOnboardingModal from "@/components/shared/ModulesOnboardingModal";
import { useModulesRuntime, enabledModules } from "@/store/modulesRuntime";
import { nav } from "./Navigation";
import { useMemo } from "react";
import { selectCurrentTab } from "@/store/selectors";
import { useStore } from "@/store/StoreProvider";
import useBootstrapModulesRuntime from "@/hooks/useBootstrapModulesRuntime";
// Imports locaux placés en bas pour garder le diff plus lisible
import Header from "./Header";
import Sidebar from "./Sidebar";
