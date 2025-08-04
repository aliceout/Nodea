import React, { useEffect, useState } from "react";
import pb from "../services/pocketbase";
import Layout from "../components/LayoutTop";
import GraphChart from "../components/Graph/GraphChart";
import { useMainKey } from "../hooks/useMainKey";
import CryptoJS from "crypto-js";

export default function GraphPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { mainKey } = useMainKey();

  function decryptField(cipherText) {
    if (!mainKey) return "";
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, mainKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return "[Erreur de déchiffrement]";
    }
  }

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

        setData(
          filtered.map((entry) => ({
            date: entry.date,
            mood: Number(decryptField(entry.mood_score)), // déchiffré et cast en number
            emoji: decryptField(entry.mood_emoji), // déchiffré
          }))
        );
      } catch (err) {
        setError("Erreur de chargement : " + (err?.message || ""));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mainKey]); // <-- ajoute mainKey en dépendance pour recharger quand la clé change

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
  if (!data.length) return <div className="p-8">Aucune donnée.</div>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mt-10 mb-4">Évolution</h1>
      <GraphChart data={data} />
    </Layout>
  );
}
