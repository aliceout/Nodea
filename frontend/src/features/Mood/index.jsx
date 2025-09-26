// src/features/Mood/Index.jsx
import { useState, useMemo } from "react";
import Subheader from "@/ui/layout/headers/Subheader";
import MoodForm from "./views/Form";
import MoodHistory from "./views/History";
import MoodGraph from "./views/Graph";

export default function MoodIndex() {
  const [active, setActive] = useState("form");

  const tabs = useMemo(
    () => [
      {
        id: "form",
        label: "Nouvelle entrée",
        active: active === "form",
        mobile: true,
      },
      {
        id: "history",
        label: "Historique",
        active: active === "history",
        mobile: true,
      },
      {
        id: "graph",
        label: "Graphique",
        active: active === "graph",
        mobile: false,
      },
    ],
    [active]
  );

  return (
    <div className="flex flex-col min-h-full">
      <Subheader
        tabs={tabs}
        onTabSelect={(id) => setActive(id)}
        cta={{ label: "Nouvelle entrée", onClick: () => setActive("form") }}
      />

      <div className="flex-1 pt-4 bg-white px-4 sm:px-6 lg:px-8">
        {active === "history" && <MoodHistory />}
        {active === "graph" && <MoodGraph />}
        {active === "form" && <MoodForm />}
      </div>
    </div>
  );
}
