import { useState } from "react";

/**
 * HistoList: liste présentielle générique.
 * - N'affiche qu'une grille et délègue le rendu à des render props.
 * Props:
 * - entries: array
 * - renderView(entry): JSX pour la carte en lecture
 * - renderEdit(entry, onCancel): JSX pour la carte en édition
 */
export default function HistoList({ entries, renderView, renderEdit }) {
  const [editId, setEditId] = useState(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {entries.map((e) => (
        <div
          key={e.id}
          className="bg-white rounded-lg shadow-sm p-4 flex flex-col justify-between h-full"
        >
          {editId === e.id
            ? renderEdit(e, () => setEditId(null))
            : renderView(e, () => setEditId(e.id))}
        </div>
      ))}
    </div>
  );
}
