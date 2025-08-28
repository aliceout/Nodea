// src/modules/Mood/History.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listMoodEntries, deleteMoodEntry } from "./data/moodEntries";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { useStore } from "@/store/StoreProvider";
import { decryptWithRetry } from "@/services/decryptWithRetry";
import FormError from "@/components/common/FormError";

// --- Helpers HMAC (dérivation du guard) ---
// On duplique ici pour limiter les refactos (pas de nouveau module).
const te = new TextEncoder();
function toHex(buf) {
  const b = new Uint8Array(buf || []);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}
async function hmacSha256(keyRaw, messageUtf8) {
  const key = await window.crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return window.crypto.subtle.sign("HMAC", key, te.encode(messageUtf8));
}
async function deriveGuard(mainKeyRaw, moduleUserId, recordId) {
  // guardKey = HMAC(mainKey, "guard:"+module_user_id)
  const guardKeyBytes = await hmacSha256(mainKeyRaw, "guard:" + moduleUserId);
  // guard    = "g_" + HEX( HMAC(guardKey, record.id) )
  const tag = await hmacSha256(guardKeyBytes, String(recordId));
  const hex = toHex(tag);
  return "g_" + hex; // 64 hex chars
}

export default function MoodHistory() {
  const { mainKey, markMissing } = useStore(); // attendu: bytes (pas CryptoKey)
  const modules = useModulesRuntime();
  const moduleUserId = modules?.mood?.id || modules?.mood?.module_user_id;

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1); // 1..12
  const [year, setYear] = useState(today.getFullYear());

  const [allEntries, setAllEntries] = useState([]); // déchiffrées
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Charger + déchiffrer
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      if (!moduleUserId) {
        setError("Module 'Humeur' non configuré.");
        setLoading(false);
        return;
      }
      if (!mainKey) {
        setError("Clé de chiffrement absente. Reconnecte-toi.");
        setLoading(false);
        return;
      }

      try {
        const items = await listMoodEntries(moduleUserId);
        const parsed = await Promise.all(
          items.map(async (r) => {
            try {
              const plaintext = await decryptWithRetry({
                encrypted: { iv: r.cipher_iv, data: r.payload },
                key: mainKey,
                markMissing,
              });
              const obj = JSON.parse(plaintext || "{}");
              return {
                id: r.id,
                created: r.created,
                date: obj.date || (r.created ? r.created.slice(0, 10) : ""),
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
              // entrée illisible → on la masque
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
  }, [moduleUserId, mainKey]);

  // Années disponibles pour le select (basé sur la date du payload)
  const years = useMemo(() => {
    const set = new Set(
      allEntries
        .map((e) => (e.date || "").slice(0, 4))
        .filter((y) => /^\d{4}$/.test(y))
        .map((y) => Number(y))
    );
    const arr = Array.from(set).sort((a, b) => b - a);
    return arr.length ? arr : [today.getFullYear()];
  }, [allEntries]);

  // Filtrage local par mois/année + tri par date du payload (du plus récent au plus ancien)
  const entries = useMemo(() => {
    const mm = String(month).padStart(2, "0");
    const yy = String(year);
    return allEntries
      .filter((e) => (e.date || "").startsWith(`${yy}-${mm}-`))
      .sort((a, b) => {
        // Tri décroissant par date du payload
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });
  }, [allEntries, month, year]);

  // Suppression : on calcule le guard (HMAC) à la volée
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
      const guard = await deriveGuard(mainKey, moduleUserId, id);
      await deleteMoodEntry(id, moduleUserId, guard);
      setAllEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err?.message || "Suppression impossible.");
    }
  }

  if (loading) {
    return <div className="w-full max-w-4xl mx-auto py-6">Chargement…</div>;
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-6">
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

import HistoryFilters from "./components/HistoryFilters";
import HistoryList from "./components/HistoryList";
