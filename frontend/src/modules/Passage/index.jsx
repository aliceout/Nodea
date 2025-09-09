// frontend/src/modules/Passage/index.jsx
import { useState, useMemo } from "react";
import Subheader from "@/components/layout/Subheader";
import PassageForm from "./Form";

export default function PassageIndex() {
  const [active, setActive] = useState("form");

  const tabs = useMemo(
    () => [
      {
        id: "form",
        label: "Nouvelle entrée",
        active: active === "form",
        mobile: true,
      },
      // Historique/Graph viendront ensuite si besoin
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
        {active === "form" && <PassageForm />}
      </div>
    </div>
  );
}
