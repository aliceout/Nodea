import React from "react";

export default function JournalComment({ comment, setComment }) {
  return (
    <div className="flex flex-col justify-center gap-1">
      <label className="text-sm font-semibold">Commentaire :</label>
      <textarea
        value={comment || ""}
        onChange={(e) => setComment(e.target.value)}
        className="w-full p-3 border rounded min-h-50"
        placeholder="Réponse optionnelle"
      />
    </div>
  );
}
