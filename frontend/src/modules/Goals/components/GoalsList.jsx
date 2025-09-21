import React, { useState, useRef, useEffect } from "react";
import Button from "@/components/common/Button";
import EditDeleteActions from "@/components/common/EditDeleteActions";
import Input from "@/components/common/Input";
import Textarea from "@/components/common/Textarea";
import Select from "@/components/common/Select";

export default function GoalsList({
  entries,
  toggleStatus,
  updateGoal,
  deleteGoal,
  moduleUserId,
  mainKey,
  setEntries,
}) {
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editThread, setEditThread] = useState("");
  const textareaRefs = useRef({});

  useEffect(() => {
    if (editId && textareaRefs.current[editId]) {
      const el = textareaRefs.current[editId];
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [editNote, editId]);

  const startEdit = (entry) => {
    setEditId(entry.id);
    setEditTitle(entry.title || "");
    setEditNote(entry.note || "");
    setEditDate(entry.date || "");
    setEditStatus(entry.status || "open");
    setEditThread(entry.thread || "");
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditTitle("");
    setEditNote("");
    setEditDate("");
    setEditStatus("");
    setEditThread("");
  };

  const saveEdit = async (entry) => {
    try {
      await updateGoal(moduleUserId, mainKey, entry.id, {
        ...entry,
        title: editTitle,
        note: editNote,
        date: editDate,
        status: editStatus,
        thread: editThread,
      });
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? {
                ...e,
                title: editTitle,
                note: editNote,
                date: editDate,
                status: editStatus,
                thread: editThread,
              }
            : e
        )
      );
      cancelEdit();
    } catch (err) {
      console.error("Erreur updateGoal:", err);
      alert("Erreur lors de la modification.");
    }
  };

  console.log("Entries from DB:", entries);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {entries.map((e) => (
        <div
          key={e.id}
          className="bg-white rounded-lg shadow-sm p-4 flex flex-col justify-between h-full"
        >
          {editId === e.id ? (
            <div className="flex flex-col gap-2">
              <Input
                label="Titre"
                value={editTitle}
                onChange={(ev) => setEditTitle(ev.target.value)}
                className="text-sm"
                required
              />
              <Input
                label="Date"
                type="date"
                value={editDate}
                onChange={(ev) => setEditDate(ev.target.value)}
                className="text-sm"
                required
              />
              <Select
                label="Statut"
                value={editStatus}
                onChange={(ev) => setEditStatus(ev.target.value)}
                className="text-sm"
              >
                <option value="open">Ouvert</option>
                <option value="wip">En cours</option>
                <option value="done">Terminé</option>
              </Select>
              <Input
                label="Hashtag / histoire"
                value={editThread}
                onChange={(ev) => setEditThread(ev.target.value)}
                className="text-sm"
              />
              <Textarea
                label="Notes"
                value={editNote}
                onChange={(ev) => setEditNote(ev.target.value)}
                className="text-sm"
                style={{
                  minHeight: "40px",
                  resize: "none",
                  overflow: "hidden",
                }}
                ref={(el) => {
                  if (el) textareaRefs.current[e.id] = el;
                }}
              />
              <div className="flex items-center justify-end gap-2 mt-2">
                <EditDeleteActions
                  isEditing={true}
                  onSave={() => saveEdit(e)}
                  onCancel={cancelEdit}
                  editClassName="text-xs px-2 py-1"
                  deleteClassName="text-xs px-2 py-1"
                />
              </div>
            </div>
          ) : (
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
                    {e.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {e.date || "—"}
                </div>
                {e.thread && (
                  <div className="text-xs text-nodea-sage-dark mb-2">
                    Histoire : <span className="font-semibold">{e.thread}</span>
                  </div>
                )}
                {e.note && (
                  <div className="text-sm text-gray-700 mb-2">{e.note}</div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 mt-2">
                <Button
                  onClick={() => toggleStatus(e)}
                  title="Changer le statut"
                  className="text-xs px-2 py-1"
                >
                  ⟳
                </Button>
                <EditDeleteActions
                  isEditing={false}
                  onEdit={() => startEdit(e)}
                  onDelete={() => deleteGoal(e.id)}
                  editClassName="text-xs px-2 py-1"
                  deleteClassName="text-xs px-2 py-1"
                />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
