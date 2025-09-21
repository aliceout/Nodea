import React from "react";
import Button from "@/components/common/Button";
import EditDeleteActions from "@/components/common/EditDeleteActions";

export default function HistoCard({ entry, onEdit, deleteGoal, toggleStatus }) {
  const statusLabels = {
    open: "Ouvert",
    wip: "En cours",
    done: "Terminé",
  };

  const e = entry;
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-base">{e.title}</span>
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
        <div className="text-xs text-gray-500 mb-2">{e.date || "—"}</div>
        {e.thread && (
          <div className="text-xs text-nodea-sage-dark mb-2">
            <span className="font-semibold">{e.thread}</span>
          </div>
        )}
        {e.note && <div className="text-sm text-gray-700 mb-2">{e.note}</div>}
      </div>
      <div className="flex items-center justify-end gap-2 mt-2">
        <Button
          onClick={() => toggleStatus?.(e)}
          title="Changer le statut"
          className="text-xs px-2 py-1"
        >
          ⟳
        </Button>
        <EditDeleteActions
          isEditing={false}
          onEdit={() => onEdit?.(e)}
          onDelete={() => deleteGoal?.(e.id)}
          editClassName="text-xs px-2 py-1"
          deleteClassName="text-xs px-2 py-1"
        />
      </div>
    </>
  );
}
