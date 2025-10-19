import React, { useEffect, useRef, useState } from "react";
import Input from "@/ui/atoms/form/Input";
import Textarea from "@/ui/atoms/form/Textarea";
import Select from "@/ui/atoms/form/Select";
import EditDeleteActions from "@/ui/atoms/actions/EditDeleteActions";

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
    <div className="flex h-full flex-col justify-between gap-3 text-sm text-gray-700">
      <div className="space-y-3">
        <Input
          label=""
          value={title}
          onChange={(ev) => setTitle(ev.target.value)}
          placeholder="Titre"
          inputClassName="text-sm font-semibold"
          required
        />

        <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
          <Input
            label=""
            type="month"
            value={date}
            onChange={(ev) => setDate(ev.target.value)}
            className="w-full max-w-[120px]"
            inputClassName="text-xs px-2 py-1"
          />
          <Select
            label=""
            value={status}
            onChange={(ev) => setStatus(ev.target.value)}
            className="w-full max-w-[140px]"
            inputClassName="text-xs px-2 py-1"
          >
            <option value="open">Ouvert</option>
            <option value="wip">En cours</option>
            <option value="done">Terminé</option>
          </Select>
        </div>

        <Input
          label=""
          value={thread}
          onChange={(ev) => setThread(ev.target.value)}
          placeholder="#hashtag"
          className="text-xs"
          inputClassName="text-xs"
        />

        <Textarea
          label=""
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          className="text-sm"
          inputClassName="text-sm"
          rows={4}
          ref={textareaRef}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <EditDeleteActions
          isEditing={true}
          onSave={onSave}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
