// frontend/src/features/Goals/views/History.jsx
import { useEffect, useMemo, useState } from "react";
import {
  listGoals,
  updateGoalStatus,
  deleteGoal,
  updateGoal,
} from "@/core/api/modules/Goals";
import { useStore } from "@/core/store/StoreProvider";
import { useModulesRuntime } from "@/core/store/modulesRuntime";
import { hasMainKeyMaterial } from "@/core/crypto/main-key";

import HistoFilters from "../components/Filters";
import HistoList from "../components/List";
import HistoEditCard from "../components/EditCard";
import HistoCard from "../components/Card";

function computeGroups(entries, { statusFilter, threadFilter, yearFilter }) {
  const filtered = entries.filter((entry) => {
    const sameStatus = !statusFilter || entry.status === statusFilter;
    const sameThread = !threadFilter || entry.thread === threadFilter;
    const sameYear =
      !yearFilter || (entry.date || "").slice(0, 4) === yearFilter;
    return sameStatus && sameThread && sameYear;
  });

  return filtered;
}

export default function GoalsHistory() {
  const { mainKey, markMissing } = useStore();
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
      setEntries([]);
      return;
    }
    if (!hasMainKeyMaterial(mainKey)) {
      setEntries([]);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const data = await listGoals(moduleUserId, mainKey, { markMissing });
        if (!cancelled) setEntries(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("[GoalsHistory] listGoals failed", err);
        if (!cancelled) setEntries([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId, markMissing]);

  const toggleStatus = async (entry) => {
    if (!moduleUserId || !hasMainKeyMaterial(mainKey)) return;

    const next =
      entry.status === "open"
        ? "wip"
        : entry.status === "wip"
        ? "done"
        : "open";
    try {
      await updateGoalStatus(moduleUserId, mainKey, entry.id, next, entry);
      setEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id ? { ...item, status: next } : item
        )
      );
    } catch (err) {
      console.error("[GoalsHistory] updateGoalStatus failed", err);
    }
  };

  const handleDeleteGoal = async (id) => {
    if (!moduleUserId || !hasMainKeyMaterial(mainKey)) return;
    const prev = entries;
    setEntries((current) => current.filter((entry) => entry.id !== id));
    try {
      await deleteGoal(moduleUserId, mainKey, id);
    } catch (err) {
      console.error("[GoalsHistory] deleteGoal failed", err);
      setEntries(prev);
    }
  };

  const filteredEntries = useMemo(
    () => computeGroups(entries, { statusFilter, threadFilter, yearFilter }),
    [entries, statusFilter, threadFilter, yearFilter]
  );

  const years = useMemo(
    () =>
      Array.from(
        new Set(entries.map((entry) => (entry.date || "").slice(0, 4)))
      ).filter(Boolean),
    [entries]
  );

  const threads = useMemo(
    () =>
      Array.from(
        new Set(entries.map((entry) => (entry.thread || "").trim()))
      ).filter(Boolean),
    [entries]
  );

  const groups = useMemo(() => {
    const map = new Map();
    const makeKey = (entry) => {
      if (groupBy === "year") {
        return (entry.date || "").slice(0, 4) || "(inconnu)";
      }
      const normalized = (entry.thread || "").trim();
      return normalized || "(sans thread)";
    };

    for (const entry of filteredEntries) {
      const key = makeKey(entry);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }

    return Array.from(map.entries()).sort((a, b) =>
      String(a[0]).localeCompare(String(b[0]))
    );
  }, [filteredEntries, groupBy]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto px-4">
      <HistoFilters
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        threadFilter={threadFilter}
        setThreadFilter={setThreadFilter}
        yearFilter={yearFilter}
        setYearFilter={setYearFilter}
        allThreads={threads}
        years={years}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
      />
      {groups.map(([label, items]) => (
        <section key={label} className="space-y-2">
          <h3 className="text-sm font-semibold text-nodea-sage-dark">
            {groupBy === "year" ? `Annee: ${label}` : `Thread: ${label}`}
          </h3>
          <HistoList
            entries={items}
            renderView={(entry, onEdit) => (
              <HistoCard
                entry={entry}
                onEdit={onEdit}
                deleteGoal={handleDeleteGoal}
                toggleStatus={toggleStatus}
              />
            )}
            renderEdit={(entry, onCancel) => (
              <HistoEditCard
                entry={entry}
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
