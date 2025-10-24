import React, { useEffect, useMemo, useState } from "react";
import { listMoodEntries, deleteMoodEntry } from "@/core/api/modules/Mood";
import { useModulesRuntime } from "@/core/store/modulesRuntime";
import { useStore } from "@/core/store/StoreProvider";
import { decryptWithRetry } from "@/core/crypto/webcrypto";
import { deriveGuard } from "@/core/crypto/guards";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";
import FormError from "@/ui/atoms/form/FormError";

import HistoryFilters from "../components/Filters";
import HistoryList from "../components/List";

export default function MoodHistory() {
  const { mainKey, markMissing } = useStore();
  const modules = useModulesRuntime();
  const moduleUserId = modules?.mood?.id || modules?.mood?.module_user_id;

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1); // 1..12
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
        setError("Module 'Humeur' non configure.");
        setLoading(false);
        return;
      }
      if (!hasMainKeyMaterial(mainKey)) {
        setError("Cle de chiffrement absente. Reconnecte-toi.");
        setLoading(false);
        return;
      }

      try {
        const items = await listMoodEntries(moduleUserId);
        const parsed = await Promise.all(
          items.map(async (record) => {
            try {
              const plaintext = await decryptWithRetry({
                encrypted: { iv: record.cipher_iv, data: record.payload },
                key: mainKey,
                markMissing,
              });
              const obj = JSON.parse(plaintext || "{}");
              return {
                id: record.id,
                created: record.created,
                date: obj.date || (record.created ? record.created.slice(0, 10) : ""),
                mood_score: obj.mood_score ?? "",
                mood_emoji: obj.mood_emoji ?? "",
                positive1: obj.positive1 ?? "",
                positive2: obj.positive2 ?? "",
                positive3: obj.positive3 ?? "",
                comment: obj.comment ?? "",
                question: obj.question ?? "",
                answer: obj.answer ?? "",
              };
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          setAllEntries(parsed.filter(Boolean));
        }
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
  }, [moduleUserId, mainKey, markMissing]);

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
    const mm = String(month).padStart(2, "0");
    const yy = String(year);
    return allEntries
      .filter((entry) => (entry.date || "").startsWith(`${yy}-${mm}-`))
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });
  }, [allEntries, month, year]);

  async function handleDelete(id) {
    setError("");

    if (!moduleUserId || !hasMainKeyMaterial(mainKey)) {
      setError("Contexte invalide (cle ou module).");
      return;
    }

    // eslint-disable-next-line no-alert
    const ok = window.confirm("Supprimer definitivement cette entree ?");
    if (!ok) return;

    try {
      const guard = await deriveGuard(mainKey, moduleUserId, id);
      await deleteMoodEntry(id, moduleUserId, guard);
      setAllEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      setError(err?.message || "Suppression impossible.");
    }
  }

  if (loading) {
    return <div className="w-full max-w-4xl mx-auto py-6">Chargement...</div>;
  }

  return (
    <div className="w-full px-10 mx-auto py-6">
      <h1 className="text-2xl font-bold mb-4">Historique</h1>

      {error ? <FormError message={error} /> : null}

      <HistoryFilters
        month={month}
        setMonth={(v) => setMonth(Number(v))}
        year={year}
        setYear={(v) => setYear(Number(v))}
        years={years}
      />

      <HistoryList entries={entries} onDelete={handleDelete} />
    </div>
  );
}


