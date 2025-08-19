// src/components/layout/Navigation.jsx (extrait)
import {
  SparklesIcon,
  HomeIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import Home from "../../modules/Homepage";
import MoodIndex from "../../modules/Mood";
import Settings from "../../modules/Settings";

export const nav = [
  {
    id: "home",
    label: "Home",
    icon: HomeIcon,
    title: "Accueil",
    position: "top",
    element: <Home />,
    display: true,
  },
  // 👇 Un seul item pour Mood
  {
    id: "mood",
    label: "Mood",
    icon: SparklesIcon,
    title: "Mood",
    position: "top",
    element: <MoodIndex />,
    display: true,
  },
  {
    id: "settings",
    label: "Mon compte",
    icon: Cog6ToothIcon,
    title: "Mon compte",
    position: "bottom",
    element: <Settings />,
    display: false,
  },
];
