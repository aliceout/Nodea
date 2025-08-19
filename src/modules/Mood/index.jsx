// src/modules/Mood/Index.jsx
import { useState, useMemo } from "react";
import Subheader from "../../components/layout/Subheader";
import MoodForm from "./Form";
import MoodHistory from "./History";
import MoodGraph from "./Graph";

export default function MoodIndex() {
  // onglet/sous-page actif du module (indépendant de la nav globale)
  const [active, setActive] = useState("form"); // "history" par défaut

  const tabs = useMemo(
    () => [
      { id: "form", label: "Nouvelle entrée", active: active === "form" },
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

      <div className="flex-1 pt-4 bg-white">
        {active === "history" && <MoodHistory />}
        {active === "graph" && <MoodGraph />}
        {active === "form" && <MoodForm />}
      </div>
    </div>
  );
}
