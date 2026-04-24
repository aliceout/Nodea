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
    <div className="flex min-h-full flex-col bg-slate-50 transition-colors dark:bg-slate-950">
      <Subheader
        tabs={tabs}
        onTabSelect={(id) => setActive(id)}
        cta={{ label: "Nouvelle entrée", onClick: () => setActive("form") }}
      />

      <div className="flex-1 bg-white px-4 pt-4 transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
        {active === "history" && <MoodHistory />}
        {active === "graph" && <MoodGraph />}
        {active === "form" && <MoodForm />}
      </div>
    </div>
  );
}
