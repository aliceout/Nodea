import React, { useEffect, useState } from "react";
import pb from "../services/pocketbase";
import Layout from "../components/LayoutTop";

export default function HistoryPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-12
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

  // Suppression d’une entrée
  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette entrée ?")) return;
    try {
      await pb.collection("journal_entries").delete(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert("Erreur lors de la suppression : " + (err?.message || ""));
    }
  };

  // Filtrer les entrées sur le mois/année choisi
  const filtered = entries.filter((entry) => {
    const date = new Date(entry.date);
    return (
      date.getMonth() + 1 === Number(month) &&
      date.getFullYear() === Number(year)
    );
  });

  if (loading) return <div className="p-8">Chargement...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  // Liste des années présentes dans les données
  const years = [
    ...new Set(entries.map((e) => new Date(e.date).getFullYear())),
  ].sort((a, b) => b - a);

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4 mt-10">Historique</h1>
      <div className="flex gap-4 mb-6">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border rounded p-1"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(0, i).toLocaleString("fr-FR", { month: "long" })}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="border rounded p-1"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <ul className="flex flex-wrap gap-8 w-full px-10 ">
        {filtered.length === 0 && (
          <div className="text-gray-500">Aucune entrée pour cette période.</div>
        )}
        {filtered.map((entry) => (
          <li
            key={entry.id}
            className="relative mb-6 pr-12 p-4 bg-white rounded shadow min-w-[250px] max-w-xs flex-1"
          >
            <div className="flex items-center mb-2 justify-between">
              {(() => {
                const dateObj = new Date(entry.date);
                const jours = [
                  "dimanche",
                  "lundi",
                  "mardi",
                  "mercredi",
                  "jeudi",
                  "vendredi",
                  "samedi",
                ];
                const jour = jours[dateObj.getDay()];
                const dd = String(dateObj.getDate()).padStart(2, "0");
                const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
                return (
                  <span className="font-bold">
                    {jour.charAt(0).toUpperCase() + jour.slice(1)}
                    <span className="mx-1 text-gray-500"></span>
                    {dd}.{mm}
                  </span>
                );
              })()}
              <div className="flex items-center justify-center">
                <span className="text-xl mr-3">{entry.mood_emoji}</span>
                <span className="ml-auto px-2 py-1 rounded bg-blue-50">
                  {entry.mood_score}
                </span>
              </div>
              {/* Bouton suppression croix */}
              <button
                onClick={() => handleDelete(entry.id)}
                className="absolute top-2 right-2 bg-white rounded-full p-1 hover:bg-red-100 transition group"
                title="Supprimer"
                tabIndex={-1}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="block"
                >
                  <circle
                    cx="10"
                    cy="10"
                    r="10"
                    fill="#F87171"
                    opacity="0.20"
                  />
                  <path
                    d="M7 7L13 13M13 7L7 13"
                    stroke="#DC2626"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div>
              <div className="mb-1">+ {entry.positive1}</div>
              <div className="mb-1">+ {entry.positive2}</div>
              <div className="mb-1">+ {entry.positive3}</div>
            </div>
            {entry.comment && (
              <div className="mt-2 text-gray-700 italic">{entry.comment}</div>
            )}
          </li>
        ))}
      </ul>
    </Layout>
  );
}
