import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/core/store/StoreProvider";
import { useModulesRuntime } from "@/core/store/modulesRuntime";
import { decryptWithRetry } from "@/core/crypto/webcrypto";
import { listMoodEntries } from "@/core/api/modules/Mood";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";

const MONTHS_DEFAULT = 6;

function normaliseMonths(months) {
  if (typeof months !== "number" || Number.isNaN(months)) {
    return MONTHS_DEFAULT;
  }
  return Math.max(1, Math.floor(months));
}

export default function useMoodTrend(options = {}) {
  const months = normaliseMonths(options.months ?? MONTHS_DEFAULT);

  const { mainKey, markMissing } = useStore();
  const modulesRuntime = useModulesRuntime();
  const moduleUserId =
    modulesRuntime?.mood?.id || modulesRuntime?.mood?.module_user_id || null;

  const [state, setState] = useState({
    status: "idle",
    data: [],
    error: "",
  });

  useEffect(() => {
    if (!hasMainKeyMaterial(mainKey)) {
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
        const items = await listMoodEntries(moduleUserId);
        const rows = [];

        for (const entry of items) {
          try {
            const plaintext = await decryptWithRetry({
              encrypted: { iv: entry.cipher_iv, data: entry.payload },
              key: mainKey,
              markMissing,
            });

            const obj = JSON.parse(plaintext || "{}");
            const date =
              obj.date ||
              (entry.created ? String(entry.created).slice(0, 10) : "");
            const score = Number(obj.mood_score);
            const emoji = obj.mood_emoji || "";

            if (!date || Number.isNaN(score)) continue;

            rows.push({
              date,
              mood: score,
              emoji,
            });
          } catch (err) {
            if (process.env.NODE_ENV === "development") {
              console.warn("useMoodTrend: decrypt failed", err);
            }
          }
        }

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
        const filtered = rows.filter((row) => {
          const candidate = new Date(row.date);
          if (Number.isNaN(candidate.getTime())) return false;
          return candidate >= start && candidate <= now;
        });

        filtered.sort((a, b) => a.date.localeCompare(b.date));

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
  }, [mainKey, moduleUserId, markMissing, months]);

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
