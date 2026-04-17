import { useEffect, useState } from "react";

import { listAnnouncements } from "@/core/api/announcements";

export default function useLatestAnnouncement() {
  const [state, setState] = useState({
    status: "idle",
    announcement: null,
    error: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: "loading", announcement: null, error: "" });
      const items = await listAnnouncements({ limit: 1 });
      if (cancelled) return;
      const latest = items.length ? items[0] : null;
      setState({
        status: latest ? "ready" : "empty",
        announcement: latest,
        error: "",
      });
    }

    load().catch((error) => {
      if (cancelled) return;
      const message =
        error instanceof Error ? error.message : "Impossible de charger.";
      setState({ status: "error", announcement: null, error: message });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
