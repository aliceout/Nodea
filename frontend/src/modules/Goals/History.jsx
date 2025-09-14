import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listGoals, updateGoalStatus } from "@/services/dataModules/Goals";
import { useMainKey } from "@/hooks/useMainKey";
import Button from "@/components/common/Button";

/**
 * Liste des objectifs (Goals)
 * - Lecture via listGoals()
 * - Bascule rapide du statut (open/wip/done)
 * - Filtres basiques par status et catégories
 */
export default function GoalsHistory() {
  const navigate = useNavigate();
  const { mainKey } = useMainKey();

  const [entries, setEntries] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    if (!mainKey) return;
    listGoals(mainKey).then(setEntries).catch(console.error);
  }, [mainKey]);

  const toggleStatus = async (entry) => {
    const next =
      entry.status === "open"
        ? "wip"
        : entry.status === "wip"
        ? "done"
        : "open";
    await updateGoalStatus(mainKey, entry.id, entry, next);
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, status: next } : e))
    );
  };

  const filtered = entries.filter((e) => {
    return (
      (!statusFilter || e.status === statusFilter) &&
      (!categoryFilter || e.categories.includes(categoryFilter))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">Tous les statuts</option>
          <option value="open">Ouverts</option>
          <option value="wip">En cours</option>
          <option value="done">Terminés</option>
        </select>
        <input
          type="text"
          placeholder="Filtrer par catégorie"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border rounded px-2 py-1"
        />
      </div>

      <ul className="divide-y">
        {filtered.map((e) => (
          <li key={e.id} className="py-2 flex justify-between items-center">
            <div>
              <div className="font-medium">{e.title}</div>
              <div className="text-sm text-gray-500">{e.note}</div>
              <div className="text-xs text-gray-400">
                {e.status} | {e.categories.join(", ")}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => toggleStatus(e)}>⟳</Button>
              <Button onClick={() => navigate(e.id)}>✎</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
