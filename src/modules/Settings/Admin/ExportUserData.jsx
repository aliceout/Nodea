import React, { useState } from "react";
import pb from "../../../services/pocketbase";

export default function ExportUserDataButton({ user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleExport = async () => {
    setLoading(true);
    setError("");
    try {
      const entries = await pb.collection("mood_entries").getFullList({
        filter: `user="${user.id}"`,
        sort: "date",
        $autoCancel: false,
      });
      // Crée le blob et télécharge
      const data = JSON.stringify(entries, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${user.username}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      setError("Erreur lors de l’export");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start">
      <button
        className="bg-green-200 px-3 py-1 rounded hover:bg-green-300 text-sm text-green-700"
        onClick={handleExport}
        disabled={loading}
      >
        {loading ? "Chargement…" : "Exporter"}
      </button>
      {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
    </div>
  );
}
