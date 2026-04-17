import React, { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import KeyMissingModal from "@/ui/atoms/specifics/KeyMissingModal";
import OnboardingModal from "@/ui/atoms/specifics/OnboardingModal";
import { nav } from "./navigation/Navigation";
import { useStore } from "@/core/store/StoreProvider";
import useBootstrapModulesRuntime from "@/core/hooks/useBootstrapModulesRuntime";
import useAuth from "@/core/auth/useAuth";

// UI conteneurs
import Header from "./headers/Header";
import Sidebar from "./navigation/Sidebar";

export default function Layout() {
  // Boot runtime modules (inchangé)
  useBootstrapModulesRuntime();

  // Phase 8b: the active module is driven by the URL (/flow/:moduleId).
  // Replaces the previous `currentTab` store field.
  const { moduleId } = useParams();
  const current = moduleId ?? "home";

  const ActiveView = useMemo(() => {
    return nav.find((t) => t.id === current)?.element ?? null;
  }, [current]);

  const moduleKnown = useMemo(
    () => nav.some((t) => t.id === current),
    [current]
  );

  // Store global (onboarding + key status)
  const { keyStatus, logout } = useStore();

  // --- Pilotage onboarding par champs users (sans version) ---
  const {
    user,
    onboardingStatus, // null | "needed" | "done"
    finishOnboarding, // -> patch { onboarding_status: "done" }
    // updateUserMeta,      // dispo si besoin
    // snoozeOnboarding,    // dispo si tu gardes "Plus tard"
  } = useAuth();

  // État local : ouverture + variante d’affichage
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [variant, setVariant] = React.useState("initial"); // "initial"
  const [ready, setReady] = React.useState(false);

  // Anti-flash (laisser la page se poser)
  React.useEffect(() => {
    const timer = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Décision d’ouverture : vide ou "needed" -> ouvrir
  React.useEffect(() => {
    if (!ready) return;
    if (!user) return; // pas loggé

    const shouldOpen = !onboardingStatus || onboardingStatus === "needed";
    if (shouldOpen) {
      setVariant("initial");
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [ready, user, onboardingStatus]);

  // Actions (branchées sur la modale)
  const handleFinish = async () => {
    await finishOnboarding(); // { onboarding_status: "done" }
    setShowOnboarding(false);
  };

  // Unknown module id in the URL → send the user home.
  if (!moduleKnown) {
    return <Navigate to="/flow/home" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors">
      {keyStatus === "missing" && <KeyMissingModal onLogout={logout} />}

      {/* Ouverture contrôlée par users.onboarding_status */}
      {keyStatus !== "missing" && showOnboarding && ready && (
        <OnboardingModal
          open={true}
          variant={variant}
          onFinish={handleFinish}
          // onSnooze={undefined} // passe-le si tu veux afficher "Plus tard"
        />
      )}

      <Sidebar />
      <div className="flex flex-col flex-1 bg-slate-50 dark:bg-slate-950 transition-colors">
        <Header />
        <main className="flex-1 bg-white dark:bg-slate-900 transition-colors">
          {ActiveView}
        </main>
      </div>
    </div>
  );
}
