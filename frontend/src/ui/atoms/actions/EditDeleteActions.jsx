import React from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";

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
    <div className={`flex items-center ${className}`}>
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
        <Menu as="div" className="relative inline-flex">
          <MenuButton
            title="Actions"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition focus-visible:outline-none"
          >
            <EllipsisVerticalIcon className="h-4 w-4" />
          </MenuButton>
          <MenuItems
            transition
            className="absolute right-0 z-30 mt-2 w-32 origin-top-right rounded-lg bg-white/95 p-1 text-xs shadow-md shadow-emerald-900/10 backdrop-blur data-[closed]:scale-95 data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75"
          >
            <MenuItem>
              {({ active }) => (
                <button
                  type="button"
                  onClick={onEdit}
                  className={`w-full rounded-md px-3 py-2 text-left transition ${
                    active ? "bg-sky-50 text-slate-600" : "text-slate-600"
                  }`}
                >
                  {editLabel}
                </button>
              )}
            </MenuItem>
            <MenuItem>
              {({ active }) => (
                <button
                  type="button"
                  onClick={onDelete}
                  className={`w-full rounded-md px-3 py-2 text-left transition ${
                    active ? "bg-rose-50 text-rose-600" : "text-rose-600"
                  }`}
                >
                  {deleteLabel}
                </button>
              )}
            </MenuItem>
          </MenuItems>
        </Menu>
      )}
    </div>
  );
}
