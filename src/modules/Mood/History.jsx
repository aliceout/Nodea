// src/modules/Mood/History.jsx
import { useEffect, useMemo, useState } from "react";
import pb from "@/services/pocketbase";
import  useAuth  from "@/hooks/useAuth";
import { useMainKey } from "@/hooks/useMainKey";
import { loadModulesConfig, getModuleEntry } from "@/services/modules-config";
import { decryptAESGCM } from "@/services/webcrypto";

import HistoryFilters from "./components/HistoryFilters";
import HistoryList from "./components/HistoryList";
import KeyMissingMessage from "@/components/common/KeyMissingMessage";

export default function HistoryPage() {
  // --- filtres mois / année (inchangés visuellement) ---
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // --- état de page ---
  const [items, setItems] = useState([]); // entrées prêtes à afficher
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- contextes / clés ---
  const { user } = useAuth();
  const { mainKey } = useMainKey(); // peut être Uint8Array(32) ou CryptoKey
  const [cryptoKey, setCryptoKey] = useState(null);

  // 1) Prépare une CryptoKey WebCrypto (si mainKey est Uint8Array)
  useEffect(() => {
    let cancelled = false;

    async function ensureCryptoKey() {
      if (!mainKey) {
        setCryptoKey(null);
        return;
      }
      // Déjà une CryptoKey ?
      if (typeof mainKey === "object" && mainKey?.type === "secret") {
        if (!cancelled) setCryptoKey(mainKey);
        return;
      }
      try {
        const k = await window.crypto.subtle.importKey(
          "raw",
          mainKey, // Uint8Array(32)
          { name: "AES-GCM" },
          false,
          ["decrypt"]
        );
        if (!cancelled) setCryptoKey(k);
      } catch {
        if (!cancelled) setCryptoKey(null);
      }
    }

    ensureCryptoKey();
    return () => {
      cancelled = true;
    };
  }, [mainKey]);

  // 2) Charge config des modules -> module_user_id du module "mood" -> fetch des entrées -> déchiffre
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!user?.id || !cryptoKey) return;
      try {
        setLoading(true);
        setError("");

        // a) récupère la config déchiffrée
        const cfg = await loadModulesConfig(pb, user.id, cryptoKey);
        const moodEntry = getModuleEntry(cfg, "mood");
        const sid = moodEntry?.module_user_id;
        if (!sid) {
          if (mounted) {
            setItems([]);
            setLoading(false);
            setError("Module 'mood' inactif ou non configuré.");
          }
          return;
        }

        // b) récupère les lignes pour ce module_user_id
        const rows = await pb.collection("mood_entries").getFullList({
          filter: `module_user_id = "${sid}"`,
          sort: "-created",
          $autoCancel: false,
        });

        // c) déchiffre chaque payload et normalise pour l'UI
        const out = [];
        for (const r of rows) {
          try {
            const plaintext = await decryptAESGCM(
              { iv: r.cipher_iv, data: r.payload },
              cryptoKey
            );
            // On stocke JSON dans payload ; on parse
            const p = JSON.parse(plaintext);

            // Normalisation soft vers ce que ton HistoryList attendait
            out.push({
              id: r.id,
              created: r.created,
              updated: r.updated,

              // champs d’affichage historiques (les noms que tes composants utilisent)
              date: p.dateISO || p.date || r.created, // fallback
              mood_score:
                typeof p.moodScore === "number"
                  ? p.moodScore
                  : Number(p.mood_score) || null,
              mood_emoji: p.moodEmoji || p.mood_emoji || "",
              positive1: p.pos1 ?? p.positive1 ?? "",
              positive2: p.pos2 ?? p.positive2 ?? "",
              positive3: p.pos3 ?? p.positive3 ?? "",
              question: p.question ?? "",
              answer: p.answer ?? "",
              comment: p.comment ?? "",
            });
          } catch {
            // ignore la ligne illisible
          }
        }

        if (mounted) {
          setItems(out);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError("Impossible de charger l'historique.");
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id, cryptoKey]);

  // 3) Dérive la liste des années pour le sélecteur (sur items déjà déchiffrés)
  const years = useMemo(() => {
    const set = new Set(
      items.map((e) => new Date(e.date).getFullYear()).filter((y) => !isNaN(y))
    );
    return [...set].sort((a, b) => b - a);
  }, [items]);

  // 4) Applique le filtre mois/année
  const filtered = useMemo(() => {
    return items.filter((entry) => {
      const d = new Date(entry.date);
      if (isNaN(d)) return false;
      return (
        d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year)
      );
    });
  }, [items, month, year]);

  // 5) Suppression (identique au comportement d’avant)
  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette entrée ?")) return;
    try {
      await pb.collection("mood_entries").delete(id);
      setItems((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert("Erreur lors de la suppression : " + (err?.message || ""));
    }
  };

  // --- états d’affichage (inchangés côté style) ---
  if (!mainKey)
    return (
      <KeyMissingMessage context="afficher l’historique" className="m-5" />
    );
  if (!cryptoKey) return <div className="p-8">Chargement de la clé…</div>;
  if (loading) return <div className="p-8">Chargement...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <>
      <HistoryFilters
        month={month}
        setMonth={setMonth}
        year={year}
        setYear={setYear}
        years={years}
      />
      <HistoryList
        entries={filtered}
        onDelete={handleDelete}
        // compat: plus besoin de decryptField, tout est déchiffré en amont
        decryptField={() => ""}
      />
    </>
  );
}
