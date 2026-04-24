import { useEffect, useMemo, useState } from "react";
import { moodClient } from "@/core/api/modules/mood";
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from "@/core/store/nodea-store";
import FormError from "@/ui/atoms/form/FormError";

import HistoryFilters from "../components/Filters";
import HistoryList from "../components/List";

/**
 * Mood history view.
 *
 * Reads decrypted entries through `moodClient.list()` (the client handles
 * AES-GCM decryption + Zod parsing under the hood). Deletion goes via
 * `moodClient.remove()` — HMAC guard derivation lives there too.
 */
export default function MoodHistory() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules?.mood?.moduleUserId ?? null;

  const today = new Date();
  const [month, setMonth] = useState(null); // null = last 6 months
  const [year, setYear] = useState(today.getFullYear());

  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      if (!moduleUserId) {
        setError("Module « Humeur » non configuré.");
        setLoading(false);
        return;
      }
      if (!mainKey) {
        setError("Clé de chiffrement absente. Reconnecte-toi.");
        setLoading(false);
        return;
      }

      try {
        const records = await moodClient.list(moduleUserId, mainKey);
        const parsed = records.map((record) => {
          const obj = record.payload || {};
          return {
            id: record.id,
            created: record.createdAt,
            date:
              obj.date || (record.createdAt ? String(record.createdAt).slice(0, 10) : ""),
            mood_score: obj.mood_score ?? "",
            mood_emoji: obj.mood_emoji ?? "",
            positive1: obj.positive1 ?? "",
            positive2: obj.positive2 ?? "",
            positive3: obj.positive3 ?? "",
            comment: obj.comment ?? "",
            question: obj.question ?? "",
            answer: obj.answer ?? "",
          };
        });

        if (!cancelled) setAllEntries(parsed);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Erreur de chargement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [moduleUserId, mainKey]);

  const years = useMemo(() => {
    const set = new Set(
      allEntries
        .map((entry) => (entry.date || "").slice(0, 4))
        .filter((y) => /^\d{4}$/.test(y))
        .map((y) => Number(y))
    );
    const arr = Array.from(set).sort((a, b) => b - a);
    return arr.length ? arr : [today.getFullYear()];
  }, [allEntries]);

  const entries = useMemo(() => {
    const sorted = [...allEntries].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });

    if (month === null) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      return sorted.filter((entry) => {
        if (!entry.date) return false;
        const candidate = new Date(entry.date);
        if (Number.isNaN(candidate.getTime())) return false;
        return candidate >= start && candidate <= now;
      });
    }

    const mm = String(month).padStart(2, "0");
    const yy = String(year);

    return sorted.filter((entry) =>
      (entry.date || "").startsWith(`${yy}-${mm}-`)
    );
  }, [allEntries, month, year]);

  async function handleDelete(id) {
    setError("");

    if (!moduleUserId || !mainKey) {
      setError("Contexte invalide (clé ou module).");
      return;
    }

    // eslint-disable-next-line no-alert
    const ok = window.confirm("Supprimer définitivement cette entrée ?");
    if (!ok) return;

    try {
      await moodClient.remove(moduleUserId, mainKey, id);
      setAllEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      setError(err?.message || "Suppression impossible.");
    }
  }

  if (loading) {
    return <div className="w-full max-w-4xl mx-auto py-6">Chargement…</div>;
  }

  return (
    <div className="w-full px-10 mx-auto py-6">
      <h1 className="text-2xl font-bold mb-4">Historique</h1>

      {error ? <FormError message={error} /> : null}

      <HistoryFilters
        month={month}
        setMonth={setMonth}
        year={year}
        setYear={(v) => setYear(Number(v))}
        years={years}
      />

      <HistoryList entries={entries} onDelete={handleDelete} />
    </div>
  );
}
