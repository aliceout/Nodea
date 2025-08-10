// src/components/layout/Content.jsx
import { useLocation, useOutletContext } from "react-router-dom";

// Modules séparés (même vides au début)
import Homepage from "../../modules/Homepage.jsx";
import MoodJournal from "../../modules/Mood/Form.jsx";
import MoodHistory from "../../modules/Mood/History.jsx";
import MoodGraph from "../../modules/Mood/Graph.jsx";
import Settings from "../../modules/Settings";

export default function Content() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/settings")) {
    return <Settings />;
  }

  const { tab } = useOutletContext();

  switch (tab) {
    case "journal":
      return <MoodJournal />;
    case "history":
      return <MoodHistory />;
    case "graph":
      return <MoodGraph />;
    case "settings":
      return <Settings />;
    case "home":
    default:
      return <Homepage />; // défaut
  }
}
