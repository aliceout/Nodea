import { useMemo } from "react";
import { nav } from "./Navigation";

import { useStore } from "../../store/StoreProvider";
import { selectCurrentTab } from "../../store/selectors";

export default function Layout() {
  // Le layout ne passe pas de props au Header/Sidebar : il se contente d'orchestrer la vue active
  const store = useStore();
  const state = store?.state ?? store?.[0];

  const current = selectCurrentTab(state);

  const ActiveView = useMemo(() => {
    return nav.find((t) => t.id === current)?.element ?? null;
  }, [current]);

  return (
    <div className="min-h-screen bg-slate-50 flex ">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex-1 bg-white">
          {ActiveView}
        </main>
      </div>
    </div>
  );
}

// Imports locaux placés en bas pour garder le diff plus lisible
import Header from "./Header";
import Sidebar from "./Sidebar";
