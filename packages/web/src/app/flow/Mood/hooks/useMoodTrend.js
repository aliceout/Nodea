import { useEffect, useMemo, useState } from "react";
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from "@/core/store/nodea-store";
import { moodClient } from "@/core/api/modules/mood";

const MONTHS_DEFAULT = 6;

function normaliseMonths(months) {
  if (typeof months !== "number" || Number.isNaN(months)) {
    return MONTHS_DEFAULT;
  }
  return Math.max(1, Math.floor(months));
}

function normaliseLatestEntries(limit) {
  if (typeof limit !== "number" || Number.isNaN(limit)) {
    return 0;
  }
  return Math.max(0, Math.floor(limit));
}

/**
 * Load decrypted mood entries and prepare chart-friendly rows.
 *
 * When `latestEntries` is provided, it overrides the `months` filtering window.
 *
 * @param {object} [options]
 * @param {number} [options.months=6] Number of months to include when no explicit limit is provided.
 * @param {number} [options.latestEntries=0] Restrict the dataset to the latest decrypted entries.
 * @returns {{status: string, data: Array<{date: string, mood: number, emoji: string}>, error: string, hasData: boolean}}
 */
export default function useMoodTrend(options = {}) {
  const months = normaliseMonths(options.months ?? MONTHS_DEFAULT);
  const latestEntries = normaliseLatestEntries(options.latestEntries ?? 0);

  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules?.mood?.moduleUserId ?? null;

  const [state, setState] = useState({
    status: "idle",
    data: [],
    error: "",
  });

  useEffect(() => {
    if (!mainKey) {
      setState({ status: "missing-key", data: [], error: "" });
      return;
    }

    if (!moduleUserId) {
      setState({ status: "missing-module", data: [], error: "" });
      return;
    }

    let cancelled = false;

    async function load() {
      setState({ status: "loading", data: [], error: "" });

      try {
        const records = await moodClient.list(moduleUserId, mainKey);
        const rows = [];

        for (const record of records) {
          const obj = record.payload || {};
          const date =
            obj.date ||
            (record.createdAt ? String(record.createdAt).slice(0, 10) : "");
          const score = Number(obj.mood_score);
          const emoji = obj.mood_emoji || "";

          if (!date || Number.isNaN(score)) continue;

          rows.push({ date, mood: score, emoji });
        }

        const sortedRows = [...rows].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
        let filtered;
        if (latestEntries > 0) {
          filtered = sortedRows.slice(-latestEntries);
        } else {
          const now = new Date();
          const start = new Date(
            now.getFullYear(),
            now.getMonth() - (months - 1),
            1
          );
          filtered = sortedRows.filter((row) => {
            const candidate = new Date(row.date);
            if (Number.isNaN(candidate.getTime())) return false;
            return candidate >= start && candidate <= now;
          });
        }

        if (!cancelled) {
          setState({ status: "ready", data: filtered, error: "" });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            data: [],
            error: err?.message || "Unexpected error",
          });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId, months, latestEntries]);

  return useMemo(
    () => ({
      status: state.status,
      data: state.data,
      error: state.error,
      hasData: state.status === "ready" && state.data.length > 0,
    }),
    [state]
  );
}
