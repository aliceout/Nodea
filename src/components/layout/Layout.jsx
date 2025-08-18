// src/components/layout/Layout.jsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { nav } from "./Navigation";

import { useStore } from "../../store/StoreProvider";
import { setTab, openMobile, closeMobile } from "../../store/actions";
import { selectCurrentTab, selectMobileOpen } from "../../store/selectors";

export default function Layout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const { state, dispatch } = useStore();
  const currentTab = selectCurrentTab(state);
  const mobileOpen = selectMobileOpen(state);

  const handleSelect = (id) => {
    dispatch(setTab(id)); // met à jour l’onglet
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const ActiveView = useMemo(
    () => nav.find((t) => t.id === currentTab)?.element ?? null,
    [currentTab]
  );

  // Titre pour le Header (depuis ta nav)
  const headerTitle = useMemo(
    () => nav.find((t) => t.id === currentTab)?.title ?? "",
    [currentTab]
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        navigation={nav}
        current={currentTab}
        onSelect={handleSelect}
        mobileOpen={mobileOpen}
        onCloseMobile={() => dispatch(closeMobile())}
      />

      <div className="flex flex-col flex-1 lg:pl-64">
        <Header
          title={headerTitle}
          onMenuClick={() => dispatch(openMobile())}
          onProfile={() => dispatch(setTab("settings"))}
          onSignOut={handleSignOut}
          user={user}
        />

        <main className="flex-1  bg-white">
          {ActiveView}
        </main>
      </div>
    </div>
  );
}
