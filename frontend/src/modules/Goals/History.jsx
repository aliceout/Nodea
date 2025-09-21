// frontend/src/modules/Goals/History.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listGoals, updateGoalStatus } from "@/services/dataModules/Goals";
import { useStore } from "@/store/StoreProvider";
import { useModulesRuntime } from "@/store/modulesRuntime";
import Button from "@/components/common/Button";

/**
 * Liste des objectifs (Goals)
 * - Lecture via listGoals(moduleUserId, mainKey)  ← sid explicit
 * - Bascule rapide du statut (open/wip/done)
 * - Filtres basiques par status et catégories
 */
export default function GoalsHistory() {
  const navigate = useNavigate();
  const { mainKey } = useStore(); // bytes (Uint8Array) en mémoire
  const modules = useModulesRuntime();
  const moduleUserId =
    modules?.goals?.id || modules?.goals?.module_user_id || "";

  const [entries, setEntries] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    if (!moduleUserId) {
      return;
    }
    if (!mainKey) {
      return;
    }

    listGoals(moduleUserId, mainKey)
      .then((data) => {
        setEntries(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        const msg = String(err?.message || err || "");
        if (msg.includes("autocancelled")) {
          return;
        }
      });
  }, [mainKey, moduleUserId]);

  const toggleStatus = async (entry) => {
    const next =
      entry.status === "open"
        ? "wip"
        : entry.status === "wip"
        ? "done"
        : "open";
    try {
      await updateGoalStatus(moduleUserId, mainKey, entry.id, next, entry);
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, status: next } : e))
      );
    } catch (err) {}
  };

  const filtered = entries.filter((e) => {
    return (
      (!statusFilter || e.status === statusFilter) &&
      (!categoryFilter || (e.categories || []).includes(categoryFilter))
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
                {e.status} | {(e.categories || []).join(", ")}
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
