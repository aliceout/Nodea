import React, { useEffect, useState } from "react";
import pb from "../../services/pocketbase";
import GraphChart from "./components/GraphChart";
import { useMainKey } from "../../hooks/useMainKey";
import { decryptAESGCM } from "../../services/webcrypto";

export default function GraphPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { mainKey } = useMainKey();
  const [cryptoKey, setCryptoKey] = useState(null);

  // Prépare la CryptoKey à partir de mainKey
  useEffect(() => {
    if (mainKey) {
      window.crypto.subtle
        .importKey("raw", mainKey, { name: "AES-GCM" }, false, [
          "encrypt",
          "decrypt",
        ])
        .then(setCryptoKey);
    }
  }, [mainKey]);

  // Fonction de déchiffrement pour les champs du graphique
  const decryptField = async (field) => {
    if (!cryptoKey || !field) return "";
    try {
      return await decryptAESGCM(JSON.parse(field), cryptoKey);
    } catch {
      return "[Erreur de déchiffrement]";
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await pb.collection("journal_entries").getFullList({
          filter: `user="${pb.authStore.model.id}"`,
          sort: "date",
          $autoCancel: false,
        });

        // Filtrer sur les 6 derniers mois glissants
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const filtered = result.filter((entry) => {
          const entryDate = new Date(entry.date);
          return entryDate >= sixMonthsAgo && entryDate <= now;
        });

        // Déchiffre les champs pour chaque entrée (en série, ou Promise.all si tu veux)
        const decrypted = [];
        for (let entry of filtered) {
          const mood_score = await decryptField(entry.mood_score);
          const mood_emoji = await decryptField(entry.mood_emoji);
          decrypted.push({
            date: entry.date,
            mood: Number(mood_score),
            emoji: mood_emoji,
          });
        }
        setData(decrypted);
      } catch (err) {
        setError("Erreur de chargement : " + (err?.message || ""));
      } finally {
        setLoading(false);
      }
    };

    if (cryptoKey) fetchData();
  }, [cryptoKey]);

  if (loading) return <div className="p-8">Chargement...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!mainKey) {
    return (
      <div className="p-8 text-red-600 font-semibold">
        ⚠️ Clé de chiffrement absente. Merci de vous reconnecter pour afficher
        le graphique.
      </div>
    );
  }
  if (!cryptoKey) return <div className="p-8">Chargement de la clé…</div>;
  if (!data.length) return <div className="p-8">Aucune donnée.</div>;

  return (
      <GraphChart data={data} />
  );
}
