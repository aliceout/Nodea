import React, { useEffect, useRef, useState } from "react";
import Input from "@/components/common/Input";
import Textarea from "@/components/common/Textarea";
import Select from "@/components/common/Select";
import DateMonthPicker from "@/components/common/DateMonthPicker";
import EditDeleteActions from "@/components/common/EditDeleteActions";

export default function HistoEditCard({
  entry,
  updateGoal,
  moduleUserId,
  mainKey,
  setEntries,
  onCancel,
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("open");
  const [thread, setThread] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!entry) return;
    setTitle(entry.title || "");
    setNote(entry.note || "");
    setDate(entry.date || "");
    setStatus(entry.status || "open");
    setThread(entry.thread || "");
  }, [entry?.id]);

  useEffect(() => {
    if (textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [note]);

  const onSave = async () => {
    try {
      const payload = { date, title, note, status, thread };
      await updateGoal(moduleUserId, mainKey, entry.id, entry, payload);
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, title, note, date, status, thread } : e
        )
      );
      onCancel?.();
    } catch (err) {
      console.error("Erreur updateGoal:", err);
      alert("Erreur lors de la modification.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Input
        label="Titre"
        value={title}
        onChange={(ev) => setTitle(ev.target.value)}
        className="text-sm"
        required
      />
      <DateMonthPicker
        label="Date"
        value={date}
        onChange={(ev) => setDate(ev.target.value)}
      />
      <Select
        label="Statut"
        value={status}
        onChange={(ev) => setStatus(ev.target.value)}
        className="text-sm"
      >
        <option value="open">Ouvert</option>
        <option value="wip">En cours</option>
        <option value="done">Terminé</option>
      </Select>
      <Input
        label="Hashtag / histoire"
        value={thread}
        onChange={(ev) => setThread(ev.target.value)}
        className="text-sm"
      />
      <Textarea
        label="Notes"
        value={note}
        onChange={(ev) => setNote(ev.target.value)}
        className="text-sm"
        style={{ minHeight: "40px", resize: "none", overflow: "hidden" }}
        ref={textareaRef}
      />
      <div className="flex items-center justify-end gap-2 mt-2">
        <EditDeleteActions
          isEditing={true}
          onSave={onSave}
          onCancel={onCancel}
          editClassName="text-xs px-2 py-1"
          deleteClassName="text-xs px-2 py-1"
        />
      </div>
    </div>
  );
}
