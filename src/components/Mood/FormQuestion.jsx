import React from "react";

export default function JournalQuestion({
  question,
  answer,
  setAnswer,
  loading,
}) {
  return (
    <div className="flex flex-col w-full basis-full md:basis-3/5 ">
      <div className="text-sm font-semibold">Question du jour :</div>
      <div className="mb-2 italic text-gray-800 text-sm">
        {loading ? <span className="opacity-50">Chargement…</span> : question}
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="w-full mb-0 p-3 border rounded min-h-18 resize-none align-top"
        rows={2}
        placeholder="Réponse optionnelle"
        disabled={loading}
      />
    </div>
  );
}
