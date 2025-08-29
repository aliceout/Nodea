// src/config/modules_list.js
import {
  HomeIcon,
  SparklesIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import Home from "../modules/Homepage";
import Mood from "../modules/Mood";
import Goals from "../modules/Goals";
import Account from "../modules/Account";
import Settings from "../modules/Settings";
import Admin from "../modules/Admin";

export const MODULES = [
  {
    id: "home",
    label: "Acceuil",
    collection: null,
    element: <Home />,
    to_toggle: false,
    description: "Homepage",
    icon: HomeIcon,
    display: true,
  },
  {
    id: "mood",
    label: "Mood",
    collection: "mood_entries",
    element: <Mood />,
    to_toggle: true,
    description: "Journal d’humeur, suivi quotidien.",
    icon: SparklesIcon,
    display: true,
  },
  {
    id: "goals",
    label: "Goals",
    collection: "goals_entries",
    element: <Goals />,
    to_toggle: true,
    description: "Objectifs, jalons, micro-actions.",
    icon: CheckCircleIcon,
    display: true,
  },
  {
    id: "account",
    label: "Mon compte",
    collection: null,
    element: <Account />,
    to_toggle: false,
    description: "Gestion du compte",
    icon: Cog6ToothIcon,
    display: false,
  },
  {
    id: "settings",
    label: "Paramètres",
    collection: null,
    element: <Settings />,
    to_toggle: false,
    description: "Paramètres des modules",
    icon: Cog6ToothIcon,
    display: false,
  },
  {
    id: "admin",
    label: "Admin",
    collection: null,
    element: <Admin />,
    to_toggle: false,
    description: "Administration",
    icon: Cog6ToothIcon,
    display: false,
  },
];

export const getModuleById = (id) => MODULES.find((m) => m.id === id) || null;
