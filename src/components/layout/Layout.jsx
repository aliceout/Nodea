// src/components/layout/Layout.jsx
import { useState, useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

import Header from "./Header";
import Sidebar from "./Sidebar";
import {
  HomeIcon,
  BookOpenIcon,
  ClockIcon,
  ChartBarIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";

export default function Layout() {
  const navigate = useNavigate();

  // mobile drawer (tu l’appelais sans l’avoir défini)
  const [mobileOpen, setMobileOpen] = useState(false);

  // onglet courant interne
  const [currentTab, setCurrentTab] = useState("home");

  // RÉPARATION: on récupère logout (et user) depuis l’auth
  const { logout, user } = useAuth();

  const navigation = useMemo(
    () => [
      { id: "home", label: "Home", icon: HomeIcon, position: "top" },
      { id: "journal", label: "Journal", icon: BookOpenIcon, position: "top" },
      { id: "history", label: "History", icon: ClockIcon, position: "top" },
      { id: "graph", label: "Graph", icon: ChartBarIcon, position: "top" },
      {
        id: "settings",
        label: "Settings",
        icon: Cog6ToothIcon,
        position: "bottom",
      },
    ],
    []
  );

  const handleSelect = (id) => {
    setCurrentTab(id);
    navigate("/flow", { replace: true }); // reste sur /flow
  };

  // handler propre pour la déconnexion
  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        navigation={navigation}
        current={currentTab}
        onSelect={handleSelect}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="lg:pl-64">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          onProfile={() => navigate("/flow?tab=settings")}
          onSignOut={handleSignOut}
          user={user ?? { name: "Utilisateur·ice" }}
        />

        <main className="px-4 sm:px-6 lg:px-8 py-6">
          <Outlet context={{ tab: currentTab }} />
        </main>
      </div>
    </div>
  );
}
