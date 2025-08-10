// src/components/layout/Layout.jsx
import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
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

  // onglet courant interne
  const [currentTab, setCurrentTab] = useState("home");

  // tout est des "tabs" internes, y compris settings
  const navigation = [
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
  ];

  const handleSelect = (id) => {
    setCurrentTab(id); // change l’onglet interne
    navigate("/flow", { replace: true }); // reste sur /flow (sans polluer l’historique)
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        navigation={navigation}
        current={currentTab}
        onSelect={handleSelect}
      />
      <div className="lg:pl-64">
        <Header onLogoClick={() => handleSelect("home")} />
        <main className="px-4 sm:px-6 lg:px-8 py-6">
          {/* on passe l’onglet courant au contenu */}
          <Outlet context={{ tab: currentTab }} />
        </main>
      </div>
    </div>
  );
}
