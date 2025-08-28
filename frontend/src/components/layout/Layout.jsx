export default function Layout() {
  useBootstrapModulesRuntime();
  const { state, keyStatus, logout } = useStore();
  const current = selectCurrentTab(state);
  const ActiveView = useMemo(() => {
    return nav.find((t) => t.id === current)?.element ?? null;
  }, [current]);

  return (
    <div className="min-h-screen bg-slate-50 flex ">
      {keyStatus === "missing" && <KeyMissingModal onLogout={logout} />}
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex-1 bg-white">{ActiveView}</main>
      </div>
    </div>
  );
}

import KeyMissingModal from "@/components/common/KeyMissingModal";
import { nav } from "./Navigation";
import { useMemo } from "react";
import { selectCurrentTab } from "@/store/selectors";
import { useStore } from "@/store/StoreProvider";
import useBootstrapModulesRuntime from "@/hooks/useBootstrapModulesRuntime";
// Imports locaux placés en bas pour garder le diff plus lisible
import Header from "./Header";
import Sidebar from "./Sidebar";
