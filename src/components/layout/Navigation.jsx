import {
  HomeIcon,
  BookOpenIcon,
  ClockIcon,
  ChartBarIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import Home from "../../modules/Homepage"; 
import Journal from "../../modules/Mood/Form";
import History from "../../modules/Mood/History";
import Graph from "../../modules/Mood/Graph";
import Settings from "../../modules/Settings";

export const nav = [
  {
    id: "home",
    label: "Home",
    icon: HomeIcon,
    title: "Acceuil",
    position: "top",
    element: <Home />,
  },
  {
    id: "moodform",
    label: "Nouvel entrée",
    icon: BookOpenIcon,
    title: "Mood - Nouvelle entrée",
    position: "top",
    element: <Journal />,
  },
  {
    id: "moodhistory",
    label: "Historique",
    icon: ClockIcon,
    title: "Mood - Historique",
    position: "top",
    element: <History />,
  },
  {
    id: "moodgraph",
    label: "Graphique",
    icon: ChartBarIcon,
    title: "Mood - Graphique",
    position: "top",
    element: <Graph />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Cog6ToothIcon,
    position: "bottom",
    element: <Settings />,
  },
];
