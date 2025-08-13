// src/components/layout/Navigation.jsx (extrait)
import {
  SparklesIcon,
  Cog6ToothIcon,
  HomeIcon,
} from "@heroicons/react/24/outline";
import Home from "../../modules/Homepage";
import Settings from "../../modules/Settings";
import MoodIndex from "../../modules/Mood"; // 👈 orchestrateur unique

export const nav = [
  {
    id: "home",
    label: "Home",
    icon: HomeIcon,
    title: "Accueil",
    position: "top",
    element: <Home />,
  },
  // 👇 Un seul item pour Mood
  {
    id: "mood",
    label: "Mood",
    icon: SparklesIcon,
    title: "Mood",
    position: "top",
    element: <MoodIndex />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Cog6ToothIcon,
    position: "bottom",
    element: <Settings />,
  },
];
