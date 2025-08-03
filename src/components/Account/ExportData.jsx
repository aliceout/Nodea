import React, { useState } from "react";
import pb from "../../services/pocketbase";

export default function ExportDataSection({ user }) {
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setSuccess("");
    setError("");
    setLoading(true);

    try {
      const entries = await pb.collection("journal_entries").getFullList({
        filter: `user="${user.id}"`,
        sort: "date",
        $autoCancel: false,
      });

      if (entries.length === 0) {
        setError("Aucune donnée à exporter");
        setLoading(false);
        return;
      }

      const data = JSON.stringify(entries, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${user.username || user.email}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setSuccess("Export terminé");
    } catch (e) {
      setError("Erreur lors de l’export");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <section className="p-4 shadow bg-white rounded flex flex-col">
      <label className="block mb-1 font-semibold">
        Exporter les données du compte
      </label>
      <button
        className="px-4 py-2 rounded bg-green-400 hover:bg-green-500 text-white w-full"
        onClick={handleExport}
        type="button"
        disabled={loading}
      >
        {loading ? "Chargement…" : "Exporter"}
      </button>
      {success && <div className="text-green-600 mt-2">{success}</div>}
      {error && <div className="text-red-500 mt-2">{error}</div>}
    </section>
  );
}
