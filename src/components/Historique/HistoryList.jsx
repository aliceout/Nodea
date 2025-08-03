import React from "react";
import HistoryEntry from "./HistoryEntry";

export default function HistoryList({ entries, onDelete }) {
  if (entries.length === 0) {
    return (
      <div className="text-gray-500">Aucune entrée pour cette période.</div>
    );
  }
  return (
    <ul className="flex flex-wrap gap-8 w-full px-10 ">
      {entries.map((entry) => (
        <HistoryEntry key={entry.id} entry={entry} onDelete={onDelete} />
      ))}
    </ul>
  );
}
