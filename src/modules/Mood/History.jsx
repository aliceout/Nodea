import React, { useEffect, useState } from "react";
import pb from "../../services/pocketbase";
import { useMainKey } from "../../hooks/useMainKey";
import { decryptAESGCM } from "../../services/webcrypto";
import Layout from "../../components/layout/LayoutTop";
import HistoryFilters from "./components/HistoryFilters";
import HistoryList from "./components/HistoryList";

export default function HistoryPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const { mainKey } = useMainKey();
  const [cryptoKey, setCryptoKey] = useState(null);

  // Prépare la CryptoKey WebCrypto à partir de mainKey
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

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await pb.collection("journal_entries").getFullList({
          filter: `user="${pb.authStore.model.id}"`,
          sort: "-date",
          $autoCancel: false,
        });

        // Déchiffrer toutes les entrées avec cryptoKey avant de les stocker
        const decrypted = await Promise.all(
          result.map(async (e) => ({
            ...e,
            mood_score: e.mood_score
              ? await decryptAESGCM(JSON.parse(e.mood_score), cryptoKey)
              : "",
            mood_emoji: e.mood_emoji
              ? await decryptAESGCM(JSON.parse(e.mood_emoji), cryptoKey)
              : "",
            positive1: e.positive1
              ? await decryptAESGCM(JSON.parse(e.positive1), cryptoKey)
              : "",
            positive2: e.positive2
              ? await decryptAESGCM(JSON.parse(e.positive2), cryptoKey)
              : "",
            positive3: e.positive3
              ? await decryptAESGCM(JSON.parse(e.positive3), cryptoKey)
              : "",
            question: e.question
              ? await decryptAESGCM(JSON.parse(e.question), cryptoKey)
              : "",
            answer: e.answer
              ? await decryptAESGCM(JSON.parse(e.answer), cryptoKey)
              : "",
            comment: e.comment
              ? await decryptAESGCM(JSON.parse(e.comment), cryptoKey)
              : "",
          }))
        );
        setEntries(decrypted);
      } catch (err) {
        setError("Erreur lors du chargement : " + (err?.message || ""));
      } finally {
        setLoading(false);
      }
    };
    if (cryptoKey) fetchEntries();
  }, [cryptoKey]);

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette entrée ?")) return;
    try {
      await pb.collection("journal_entries").delete(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert("Erreur lors de la suppression : " + (err?.message || ""));
    }
  };

  // Liste des années présentes dans les données
  const years = [
    ...new Set(entries.map((e) => new Date(e.date).getFullYear())),
  ].sort((a, b) => b - a);

  // Filtrer les entrées sur le mois/année choisi
  const filtered = entries.filter((entry) => {
    const date = new Date(entry.date);
    return (
      date.getMonth() + 1 === Number(month) &&
      date.getFullYear() === Number(year)
    );
  });

  if (!mainKey) {
    return (
      <div className="flex items-center justify-center h-64 text-red-700 text-lg font-semibold">
        ⚠️ Clé de chiffrement absente. Merci de vous reconnecter pour afficher
        l’historique.
      </div>
    );
  }
  if (!cryptoKey) return <div className="p-8">Chargement de la clé…</div>;
  if (loading) return <div className="p-8">Chargement...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4 mt-10">Historique</h1>
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
        // decryptField n’est plus utilisé, tout est déjà déchiffré
        decryptField={() => ""} // argument dummy pour compat
      />{" "}
    </Layout>
  );
}
