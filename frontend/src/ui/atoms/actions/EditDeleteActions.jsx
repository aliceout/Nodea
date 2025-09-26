import React from "react";

export default function EditDeleteActions({
  isEditing,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  editLabel = "Éditer",
  deleteLabel = "Supprimer",
  saveLabel = "Enregistrer",
  cancelLabel = "Annuler",
  className = "",
}) {
  return (
    <div className={`flex gap-2 items-center ${className}`}>
      {isEditing ? (
        <>
          <button
            title={saveLabel}
            className="p-1 hover:bg-green-50 rounded"
            onClick={onSave}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-green-700"
            >
              <polyline points="4 11 8 15 16 6" />
            </svg>
          </button>
          <button
            title={cancelLabel}
            className="p-1 hover:bg-gray-50 rounded"
            onClick={onCancel}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-500"
            >
              <line x1="6" y1="6" x2="14" y2="14" />
              <line x1="14" y1="6" x2="6" y2="14" />
            </svg>
          </button>
        </>
      ) : (
        <>
          <button
            title={editLabel}
            className="p-1 hover:bg-blue-50 rounded"
            onClick={onEdit}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-blue-700"
            >
              <path d="M12.5 5.5l2 2M4 13.5V16h2.5l7.1-7.1a1.5 1.5 0 0 0-2.1-2.1L4 13.5z" />
            </svg>
          </button>
          <button
            title={deleteLabel}
            className="p-1 hover:bg-red-50 rounded"
            onClick={onDelete}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-700"
            >
              <rect x="6" y="8" width="8" height="8" rx="2" />
              <line x1="9" y1="11" x2="9" y2="15" />
              <line x1="13" y1="11" x2="13" y2="15" />
              <path d="M10 5h4a1 1 0 0 1 1 1v2H5V6a1 1 0 0 1 1-1h4z" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
