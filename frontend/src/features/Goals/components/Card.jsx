import React from "react";
import Button from "@/ui/components/Button";
import EditDeleteActions from "@/ui/components/EditDeleteActions";

export default function HistoCard({ entry, onEdit, deleteGoal, toggleStatus }) {
  const statusLabels = {
    open: "Ouvert",
    wip: "En cours",
    done: "Terminé",
  };

  const e = entry;
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-sm">{e.title}</span>{" "}
          <EditDeleteActions
            isEditing={false}
            onEdit={() => onEdit?.(e)}
            onDelete={() => deleteGoal?.(e.id)}
            editClassName="text-xs px-2 py-1"
            deleteClassName="text-xs px-2 py-1"
          />
        </div>
        <div className="text-xs text-gray-500 flex flex-row justify-between items-center">
            {e.date || "—"}{" "}
          <span
            className={`text-xs px-2 py-1 rounded ${
                e.status === "done"
                ? "bg-green-100 text-green-700"
                : e.status === "wip"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-700"
            }`}
            >
            {statusLabels[e.status] || e.status}
          </span>
        </div>
        {e.thread && (
          <div className="text-xs text-nodea-sage-dar">
            <span className="font-semibold">{e.thread}</span>
          </div>
        )}
        {e.note && <div className="text-sm text-gray-700">{e.note}</div>}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          onClick={() => toggleStatus?.(e)}
          title="Changer le statut"
          className="text-xs px-2 py-1"
        >
          ⟳
        </Button>
      </div>
    </>
  );
}
