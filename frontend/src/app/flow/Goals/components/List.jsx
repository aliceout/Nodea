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
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((e) => (
        <div
          key={e.id}
          className="flex h-full flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900/70"
        >
          {editId === e.id
            ? renderEdit(e, () => setEditId(null))
            : renderView(e, () => setEditId(e.id))}
        </div>
      ))}
    </div>
  );
}
