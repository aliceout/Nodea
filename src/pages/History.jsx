import React, { useEffect, useState } from "react";
import pb from "../services/pocketbase";
import { useMainKey } from "../hooks/useMainKey";
import CryptoJS from "crypto-js";
import Layout from "../components/LayoutTop";
import HistoryFilters from "../components/Historique/HistoryFilters";
import HistoryList from "../components/Historique/HistoryList";

export default function HistoryPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

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
        setEntries(result);
      } catch (err) {
        setError("Erreur lors du chargement : " + (err?.message || ""));
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, []);

  const { mainKey } = useMainKey();

  function decryptField(cipherText) {
    if (!mainKey) return ""; // clé non chargée
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, mainKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return "[Erreur de déchiffrement]";
    }
  }

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
        decryptField={decryptField}
      />{" "}
    </Layout>
  );
}
