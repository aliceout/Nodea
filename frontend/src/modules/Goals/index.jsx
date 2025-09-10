// frontend/src/modules/Goals/index.jsx
import { useState, useMemo } from "react";
import Subheader from "@/components/layout/Subheader";
import GoalsForm from "./Form";
import GoalsHistory from "./History";

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
    <div className="flex flex-col min-h-full">
      <Subheader
        tabs={tabs}
        onTabSelect={(id) => setActive(id)}
        cta={{ label: "Nouvel objectif", onClick: () => setActive("form") }}
      />
      <div className="flex-1 pt-4 bg-white px-4 sm:px-6 lg:px-8">
        {active === "form" && <GoalsForm />}
        {active === "history" && <GoalsHistory />}
      </div>
    </div>
  );
}
