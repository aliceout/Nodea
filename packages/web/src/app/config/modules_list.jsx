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
    label: "modules.home.label",
    collection: null,
    element: <Home />,
    to_toggle: false,
    description: "modules.home.description",
    icon: HomeIcon,
    display: true,
  },
  {
    id: "mood",
    label: "modules.mood.label",
    collection: "mood_entries",
    element: <Mood />,
    to_toggle: true,
    description: "modules.mood.description",
    icon: SparklesIcon,
    display: true,
  },
  {
    id: "passage",
    label: "modules.passage.label",
    collection: "passage_entries",
    element: <Passage />,
    to_toggle: true,
    description: "modules.passage.description",
    icon: ArrowsRightLeftIcon,
    display: true,
  },
  {
    id: "goals",
    label: "modules.goals.label",
    collection: "goals_entries",
    element: <Goals />,
    to_toggle: true,
    description: "modules.goals.description",
    icon: CheckCircleIcon,
    display: true,
  },
  {
    id: "account",
    label: "modules.account.label",
    collection: null,
    element: <Account />,
    to_toggle: false,
    description: "modules.account.description",
    icon: Cog6ToothIcon,
    display: false,
  },
  {
    id: "settings",
    label: "modules.settings.label",
    collection: null,
    element: <Settings />,
    to_toggle: false,
    description: "modules.settings.description",
    icon: Cog6ToothIcon,
    display: false,
  },
  {
    id: "admin",
    label: "modules.admin.label",
    collection: null,
    element: <Admin />,
    to_toggle: false,
    description: "modules.admin.description",
    icon: Cog6ToothIcon,
    display: false,
  },
];

export const getModuleById = (id) => MODULES.find((m) => m.id === id) || null;

