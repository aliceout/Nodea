// src/modules/Mood/Index.jsx
import { useState, useMemo } from "react";
import Subheader from "../../components/layout/Subheader";
import MoodForm from "./Form";
import MoodHistory from "./History";
import MoodGraph from "./Graph";

export default function MoodIndex() {
  // onglet/sous-page actif du module (indépendant de la nav globale)
  const [active, setActive] = useState("history"); // "history" par défaut

  const tabs = useMemo(
    () => [
      { id: "history", label: "Historique", active: active === "history" },
      { id: "graph", label: "Graphique", active: active === "graph" },
    ],
    [active]
  );

  return (
    <div className="flex flex-col min-h-full">
      <Subheader
        tabs={tabs}
        onTabSelect={(id) => setActive(id)} // switch local
        cta={{
          label: "Nouvelle entrée",
          onClick: () => setActive("form"),
        }}
      />

      <div className="flex-1 px-4 sm:px-6 lg:px-8 pt-4 bg-white">
        {active === "history" && <MoodHistory />}
        {active === "graph" && <MoodGraph />}
        {active === "form" && <MoodForm />}
      </div>
    </div>
  );
}
