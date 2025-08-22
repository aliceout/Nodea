export default function HistoryList({ entries, onDelete, decryptField }) {
  if (entries.length === 0) {
    return (
      <div className="text-gray-500">Aucune entrée pour cette période.</div>
    );
  }
  return (
    <ul className="flex flex-wrap gap-8 w-full px-10 ">
      {entries.map((entry) => (
        <HistoryEntry
          key={entry.id}
          entry={entry}
          onDelete={onDelete}
          decryptField={decryptField}
          />
        ))}
    </ul>
  );
}

import HistoryEntry from "./HistoryEntry";