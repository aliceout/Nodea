import Button from "@/ui/atoms/base/Button";
import EditDeleteActions from "@/ui/atoms/actions/EditDeleteActions";

export default function HistoCard({ entry, onEdit, deleteGoal, toggleStatus }) {
  const statusLabels = {
    open: "Ouvert",
    wip: "En cours",
    done: "Terminé",
  };

  const e = entry;
  const formattedDate = e.date || "—";

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{e.title}</span>{" "}
          <EditDeleteActions
            isEditing={false}
            onEdit={() => onEdit?.(e)}
            onDelete={() => deleteGoal?.(e.id)}
            editClassName="text-xs px-2 py-1"
            deleteClassName="text-xs px-2 py-1"
          />
        </div>
        <div className="flex flex-row items-center justify-between text-xs text-gray-500">
          {formattedDate}{" "}
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
          <div className="text-nodea-sage-dark text-xs">
            <span className="font-semibold">{e.thread}</span>
          </div>
        )}
        {e.note ? <div className="text-sm text-gray-700">{e.note}</div> : null}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          onClick={() => toggleStatus?.(e)}
          title="Changer le statut"
          variant="ghost"
          size="sm"
          className="px-2 py-1 text-xs"
        >
          🔄
        </Button>
      </div>
    </>
  );
}
