// src/modules/Mood/Index.jsx
import { useState, useMemo } from "react";

export default function GoalsIndex() {
  // onglet/sous-page actif du module (indépendant de la nav globale)
  const [active, setActive] = useState("form"); // "history" par défaut
  
  const tabs = useMemo(
    () => [
      { id: "form", label: "Nouvelle entrée", active: active === "form", mobile: true },
      { id: "history", label: "Historique", active: active === "history", mobile: true },
      { id: "graph", label: "Graphique", active: active === "graph", mobile: false },
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

      <div className="flex-1 pt-4 bg-white px-4 sm:px-6 lg:px-8">
        {active === "history" && <MoodHistory />}
        {active === "graph" && <MoodGraph />}
        {active === "form" && <MoodForm />}
      </div>
    </div>
  );
}

import Subheader from "../../components/layout/Subheader";
import MoodForm from "../Mood/Form";
import MoodHistory from "../Mood/History";
import MoodGraph from "../Mood/Graph";