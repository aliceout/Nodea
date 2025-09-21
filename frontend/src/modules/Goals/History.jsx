// frontend/src/modules/Goals/History.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listGoals,
  updateGoalStatus,
  deleteGoal,
  updateGoal,
} from "@/services/dataModules/Goals";
import { useStore } from "@/store/StoreProvider";
import { useModulesRuntime } from "@/store/modulesRuntime";
import GoalsFilters from "./components/GoalsFilters";
import GoalsList from "./components/GoalsList";

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
  const [yearFilter, setYearFilter] = useState("");

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

  const handleDeleteGoal = async (id) => {
    const prev = entries;
    // UI optimiste
    setEntries((cur) => cur.filter((e) => e.id !== id));
    try {
      await deleteGoal(moduleUserId, mainKey, id);
    } catch (err) {
      setEntries(prev);
      // Optionnel : affiche une erreur
      // setError("Suppression impossible.");
    }
  };

  // Récupère toutes les années présentes
  const years = Array.from(
    new Set(entries.map((e) => e.date?.slice(0, 4)).filter(Boolean))
  );

  // Récupère toutes les catégories existantes
  const allCategories = Array.from(
    new Set(entries.flatMap((e) => e.categories || []).filter(Boolean))
  );

  const filtered = entries.filter((e) => {
    return (
      (!statusFilter || e.status === statusFilter) &&
      (!categoryFilter || (e.categories || []).includes(categoryFilter)) &&
      (!yearFilter || (e.date || "").startsWith(yearFilter))
    );
  });

  return (
    <div className="space-y-4 max-w-3xl mx-auto px-4">
      <GoalsFilters
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        yearFilter={yearFilter}
        setYearFilter={setYearFilter}
        allCategories={allCategories}
        years={years}
      />
      <GoalsList
        entries={filtered}
        toggleStatus={toggleStatus}
        updateGoal={updateGoal}
        deleteGoal={handleDeleteGoal}
        moduleUserId={moduleUserId}
        mainKey={mainKey}
        setEntries={setEntries}
      />
    </div>
  );
}
