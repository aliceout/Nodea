import {
  HomeIcon,
  SparklesIcon,
  ArrowsRightLeftIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import Home from "../flow/Homepage";
import Mood from "../flow/Mood";
import Passage from "../flow/Passage";
import Goals from "../flow/Goals";
import Account from "../flow/Account";
import Settings from "../flow/Settings";
import Admin from "../flow/Admin";

export const MODULES = [
  {
    id: "home",
    label: "Acceuil",
    collection: null,
    element: <Home />,
    to_toggle: false,
    description: "Vue d’ensemble, accès rapide à vos modules et infos du jour.",
    icon: HomeIcon,
    display: true,
  },
  {
    id: "mood",
    label: "Mood",
    collection: "mood_entries",
    element: <Mood />,
    to_toggle: true,
    description:
      "Notez trois données positives ou fiertés chaque jour et donnez une note à votre journée.",
    icon: SparklesIcon,
    display: true,
  },
  {
    id: "passage",
    label: "Passage",
    collection: "passage_entries",
    element: <Passage />,
    to_toggle: true,
    description: "Garder une trace de vos moments de transition de vie",
    icon: ArrowsRightLeftIcon,
    display: true,
  },
  {
    id: "goals",
    label: "Goals",
    collection: "goals_entries",
    element: <Goals />,
    to_toggle: true,
    description: "Suivre vos objectifs annuels",
    icon: CheckCircleIcon,
    display: true,
  },
  {
    id: "account",
    label: "Mon compte",
    collection: null,
    element: <Account />,
    to_toggle: false,
    description:
      "Gérez vos informations personnelles, sécurité et préférences du compte.",
    icon: Cog6ToothIcon,
    display: false,
  },
  {
    id: "settings",
    label: "Paramètres",
    collection: null,
    element: <Settings />,
    to_toggle: false,
    description:
      "Activez ou désactivez les modules, personnalisez votre expérience Nodea.",
    icon: Cog6ToothIcon,
    display: false,
  },
  {
    id: "admin",
    label: "Admin",
    collection: null,
    element: <Admin />,
    to_toggle: false,
    description:
      "Outils d’administration : gestion des utilisateurs, codes d’invitation et supervision.",
    icon: Cog6ToothIcon,
    display: false,
  },
];

export const getModuleById = (id) => MODULES.find((m) => m.id === id) || null;
