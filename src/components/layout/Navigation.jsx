import {
  SparklesIcon,
  HomeIcon,
  CheckCircleIcon,
  ChartBarIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import Home from "../../modules/Homepage";
import MoodIndex from "../../modules/Mood";
import GoalsIndex from "../../modules/Mood";
import ReviewIndex from "../../modules/Mood";
import Settings from "../../modules/Settings";

export const nav = [
  {
    id: "home",
    label: "Home",
    title: "Accueil",
    icon: HomeIcon,
    element: <Home />,
    display: true,
  },
  {
    id: "mood",
    label: "Mood",
    title: "Mood",
    icon: SparklesIcon,
    element: <MoodIndex />,
    display: true,
  },
  {
    id: "goals",
    label: "Goals",
    title: "Goals",
    icon: CheckCircleIcon,
    element: <GoalsIndex />,
    display: true,
  },
  {
    id: "review",
    label: "Review",
    title: "Review",
    icon: ChartBarIcon,
    element: <ReviewIndex />,
    display: true,
  },
  {
    id: "settings",
    label: "Mon compte",
    title: "Mon compte",
    icon: Cog6ToothIcon,
    element: <Settings />,
    display: false,
  },
];
