import React, { useState } from "react";
import pb from "../../services/pocketbase";
import CryptoJS from "crypto-js";
import { useMainKey } from "../../hooks/useMainKey";

export default function ExportDataSection({ user }) {
  const { mainKey } = useMainKey();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const decryptField = (cipherText) => {
    if (!mainKey) return "";
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, mainKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return "[Erreur de déchiffrement]";
    }
  };

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

      const decrypted = entries.map((e) => ({
        id: e.id,
        date: e.date,
        mood_score: decryptField(e.mood_score),
        mood_emoji: decryptField(e.mood_emoji),
        positive1: decryptField(e.positive1),
        positive2: decryptField(e.positive2),
        positive3: decryptField(e.positive3),
        question: decryptField(e.question),
        answer: decryptField(e.answer),
        comment: decryptField(e.comment),
      }));

      const data = JSON.stringify(decrypted, null, 2);
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
