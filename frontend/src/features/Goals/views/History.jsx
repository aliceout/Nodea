// frontend/src/features/Goals/views/History.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listGoals,
  updateGoalStatus,
  deleteGoal,
  updateGoal,
} from "@/core/api/modules/Goals";
import { useStore } from "@/core/store/StoreProvider";
import { useModulesRuntime } from "@/core/store/modulesRuntime";
import HistoFilters from "../components/Filters";
import HistoList from "../components/List";
import HistoEditCard from "../components/EditCard";
import HistoCard from "../components/Card";

export default function GoalsHistory() {
  const navigate = useNavigate();
  const { mainKey } = useStore(); // bytes (Uint8Array) en mémoire
  const modules = useModulesRuntime();
  const moduleUserId =
    modules?.goals?.id || modules?.goals?.module_user_id || "";

  const [entries, setEntries] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [threadFilter, setThreadFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [groupBy, setGroupBy] = useState("thread");

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

  // Récupère tous les threads existants (valeur unique par entrée)
  const allThreads = Array.from(
    new Set(entries.map((e) => e.thread).filter(Boolean))
  );

  const filtered = entries.filter((e) => {
    return (
      (!statusFilter || e.status === statusFilter) &&
      (!threadFilter || e.thread === threadFilter) &&
      (!yearFilter || (e.date || "").startsWith(yearFilter))
    );
  });

  // Grouping: by thread (default) or by year
  const groupsMap = new Map();
  const makeKey = (e) =>
    groupBy === "year" ? (e.date || "").slice(0, 4) || "—" : e.thread || "—";
  for (const e of filtered) {
    const key = makeKey(e);
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key).push(e);
  }
  const groups = Array.from(groupsMap.entries()).sort((a, b) =>
    String(a[0]).localeCompare(String(b[0]))
  );

  return (
    <div className="space-y-4 max-w-3xl mx-auto px-4">
      <HistoFilters
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        threadFilter={threadFilter}
        setThreadFilter={setThreadFilter}
        yearFilter={yearFilter}
        setYearFilter={setYearFilter}
        allThreads={allThreads}
        years={years}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
      />
      {groups.map(([label, items]) => (
        <section key={label} className="space-y-2">
          <h3 className="text-sm font-semibold text-nodea-sage-dark">
            {groupBy === "year" ? `Année: ${label}` : `Thread: ${label}`}
          </h3>
          <HistoList
            entries={items}
            renderView={(e, onEdit) => (
              <HistoCard
                entry={e}
                onEdit={onEdit}
                deleteGoal={handleDeleteGoal}
                toggleStatus={toggleStatus}
              />
            )}
            renderEdit={(e, onCancel) => (
              <HistoEditCard
                entry={e}
                updateGoal={updateGoal}
                moduleUserId={moduleUserId}
                mainKey={mainKey}
                setEntries={setEntries}
                onCancel={onCancel}
              />
            )}
          />
        </section>
      ))}
    </div>
  );
}
