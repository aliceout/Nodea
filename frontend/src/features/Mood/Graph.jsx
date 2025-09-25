// src/features/Mood/views/Graph.jsx
import React, { useEffect, useState } from "react";
import { useStore } from "@/store/StoreProvider";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { decryptWithRetry } from "@/services/crypto/webcrypto";
import { listMoodEntries } from "@/services/dataModules/Mood";

export default function GraphPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true); // démarre à true
  const [error, setError] = useState("");

  const { mainKey, markMissing } = useStore();
  const modules = useModulesRuntime();
  const moduleUserId = modules?.mood?.id || modules?.mood?.module_user_id;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      try {
        if (!mainKey)
          throw new Error("Clé de chiffrement absente. Reconnecte-toi.");
        if (!moduleUserId) throw new Error("Module 'Humeur' non configuré.");

        // 1) Récupère les entrées chiffrées (triées -created par le service)
        const items = await listMoodEntries(moduleUserId);

        // 2) Déchiffre chaque payload et extrait ce dont le graph a besoin
        const rows = [];
        for (const r of items) {
          try {
            const plaintext = await decryptWithRetry({
              encrypted: { iv: r.cipher_iv, data: r.payload },
              key: mainKey,
              markMissing,
            });
            const obj = JSON.parse(plaintext || "{}");

            const d =
              obj.date || (r.created ? String(r.created).slice(0, 10) : "");
            const s = Number(obj.mood_score);
            const e = obj.mood_emoji || "";

            if (!d || Number.isNaN(s)) continue;
            rows.push({ date: d, mood: s, emoji: e });
          } catch {
            // entrée illisible → on ignore
          }
        }

        // 3) Filtre : 6 derniers mois glissants
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const inRange = rows.filter((r) => {
          const dd = new Date(r.date);
          return dd >= start && dd <= now;
        });

        // 4) Tri par date ascendante pour la courbe
        inRange.sort((a, b) => a.date.localeCompare(b.date));

        if (!cancelled) setData(inRange);
      } catch (err) {
        if (!cancelled)
          setError("Erreur de chargement : " + (err?.message || ""));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId]);

  // ── Ordre des retours : d’abord l’absence de clé/module, ensuite loading/erreurs/données
  if (!mainKey)
    return (
      <div
        role="alert"
        aria-live="polite"
        className="m-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 text-center"
      >
        <p className="font-medium">Clé de chiffrement absente du cache</p>
        <p className="mt-1">
          Connecte-toi à nouveau pour afficher le graphique.
        </p>
      </div>
    );
  if (!moduleUserId)
    return (
      <div className="p-8">Module &laquo; Humeur &raquo; non configuré.</div>
    );

  if (loading) return <div className="p-8">Chargement…</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!data.length) return <div className="p-8">Aucune donnée.</div>;

  return <GraphChart data={data} />;
}

import GraphChart from "./components/Chart";
export { default } from "./views/Graph";
