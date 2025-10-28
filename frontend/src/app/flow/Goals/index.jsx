// frontend/src/features/Goals/index.jsx
import { useState, useMemo } from "react";
import Subheader from "@/ui/layout/headers/Subheader";
import GoalsForm from "./views/Form";
import GoalsHistory from "./views/History";

/**
 * Module Goals
 * - Une entrée = un objectif
 * - UI calquée sur Passage : Subheader avec 2 onglets (form / history)
 * - Pas de changement de style
 */
export default function GoalsIndex() {
  const [active, setActive] = useState("form");

  const tabs = useMemo(
    () => [
      {
        id: "form",
        label: "Nouvel objectif",
        active: active === "form",
        mobile: true,
      },
      {
        id: "history",
        label: "Historique",
        active: active === "history",
        mobile: true,
      },
    ],
    [active]
  );

  return (
    <div className="flex min-h-full flex-col bg-slate-50 transition-colors dark:bg-slate-950">
      <Subheader
        tabs={tabs}
        onTabSelect={(id) => setActive(id)}
        cta={{ label: "Nouvel objectif", onClick: () => setActive("form") }}
      />
      <div className="flex-1 bg-white px-4 pt-4 transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
        {active === "form" && <GoalsForm />}
        {active === "history" && <GoalsHistory />}
      </div>
    </div>
  );
}
