import React, { useState } from "react";
import pb from "../../services/pocketbase";
import CryptoJS from "crypto-js";
import { useMainKey } from "../../hooks/useMainKey";

export default function ImportData({ user }) {
  const { mainKey } = useMainKey();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleImport = async (e) => {
    setError("");
    setSuccess("");
    setLoading(true);
    const file = e.target.files[0];
    if (!file) {
      setError("Aucun fichier sélectionné.");
      setLoading(false);
      return;
    }
    try {
      const text = await file.text();
      let imported = JSON.parse(text);

      if (!Array.isArray(imported))
        throw new Error("Fichier invalide (tableau attendu)");

      const existingEntries = await pb
        .collection("journal_entries")
        .getFullList({
          filter: `user="${user.id}"`,
          fields: "date",
          $autoCancel: false,
        });
      const existingDates = new Set(
        existingEntries.map((e) => e.date.slice(0, 10))
      );

      let ignoredCount = 0;
      let importedCount = 0;
      for (let entry of imported) {
        const date = entry.date?.slice(0, 10);
        if (!date || existingDates.has(date))
          if (!date || existingDates.has(date)) {
            ignoredCount++;
            continue;
          }

        const encrypted = {
          user: user.id,
          date: entry.date,
          mood_score: mainKey
            ? CryptoJS.AES.encrypt(entry.mood_score || "", mainKey).toString()
            : "",
          mood_emoji: mainKey
            ? CryptoJS.AES.encrypt(entry.mood_emoji || "", mainKey).toString()
            : "",
          positive1: mainKey
            ? CryptoJS.AES.encrypt(entry.positive1 || "", mainKey).toString()
            : "",
          positive2: mainKey
            ? CryptoJS.AES.encrypt(entry.positive2 || "", mainKey).toString()
            : "",
          positive3: mainKey
            ? CryptoJS.AES.encrypt(entry.positive3 || "", mainKey).toString()
            : "",
          question: mainKey
            ? CryptoJS.AES.encrypt(entry.question || "", mainKey).toString()
            : "",
          answer: mainKey
            ? CryptoJS.AES.encrypt(entry.answer || "", mainKey).toString()
            : "",
          comment: mainKey
            ? CryptoJS.AES.encrypt(entry.comment || "", mainKey).toString()
            : "",
        };

        await pb.collection("journal_entries").create(encrypted);
        importedCount++;
      }
      setSuccess(
        `Import terminé : ${importedCount} entrée(s) ajoutée(s), ${ignoredCount} ignorée(s) (déjà présentes).`
      );
    } catch (err) {
      setError("Erreur lors de l’import : " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="p-4 shadow bg-white rounded flex flex-col">
      <label className="block mb-1 font-semibold">Importer des données</label>
      <label
        htmlFor="import-json"
        className="block mb-1 font-semibold bg-sky-400 text-white px-4 py-2 rounded hover:bg-sky-500 w-full text-center"
        style={{ display: loading ? "none" : "block" }}
      >
        Sélectionner le fichier
        <input
          id="import-json"
          type="file"
          accept="application/json"
          onChange={handleImport}
          className="hidden"
          disabled={loading}
        />
      </label>
      <span className="text-gray-500 text-xs mb-2">
        Seules les dates absentes seront ajoutées. Aucune donnée existante n’est
        modifiée. Type de fichier attendu : json
      </span>
      {success && <div className="text-green-600 mt-2">{success}</div>}
      {error && <div className="text-red-500 mt-2">{error}</div>}
    </section>
  );
}
