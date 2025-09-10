import React, { useState, useEffect } from "react";
import EditDeleteActions from "@/components/common/EditDeleteActions";

export default function HistoryEntry({ entry, onDelete, decryptField }) {
  const commentRef = React.useRef();
  // Edition inline
  const [isEditing, setIsEditing] = useState(false);
  const [editScore, setEditScore] = useState(entry.mood_score);
  const [editPositive1, setEditPositive1] = useState(entry.positive1);
  const [editPositive2, setEditPositive2] = useState(entry.positive2);
  const [editPositive3, setEditPositive3] = useState(entry.positive3);
  const [editAnswer, setEditAnswer] = useState(entry.answer);
  const [editComment, setEditComment] = useState(entry.comment);

  // Pour la démo, on ne sauvegarde que localement
  const [localEntry, setLocalEntry] = useState(entry);
  useEffect(() => {
    setLocalEntry(entry);
    setEditScore(entry.mood_score);
    setEditPositive1(entry.positive1);
    setEditPositive2(entry.positive2);
    setEditPositive3(entry.positive3);
    setEditAnswer(entry.answer);
    setEditComment(entry.comment);
  }, [entry]);

  // Refs pour textarea auto-resize
  const positive1Ref = React.useRef();

  // Auto-resize dès le passage en édition
  useEffect(() => {
    if (isEditing) {
      if (positive1Ref.current) autoResize(positive1Ref.current);
      if (positive2Ref.current) autoResize(positive2Ref.current);
      if (positive3Ref.current) autoResize(positive3Ref.current);
      if (answerRef.current) autoResize(answerRef.current);
      if (commentRef.current) autoResize(commentRef.current);
    }
  }, [isEditing]);

  // Date and day calculation
  // ...existing code...
  const positive2Ref = React.useRef();
  const positive3Ref = React.useRef();
  const answerRef = React.useRef();

  // Fonction utilitaire pour auto-resize textarea
  const autoResize = (el) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  // Auto-resize dès le passage en édition
  useEffect(() => {
    if (isEditing) {
      if (positive1Ref.current) autoResize(positive1Ref.current);
      if (positive2Ref.current) autoResize(positive2Ref.current);
      if (positive3Ref.current) autoResize(positive3Ref.current);
      if (answerRef.current) autoResize(answerRef.current);
    }
  }, [isEditing]);

  // Date and day calculation
  const jours = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ];
  const dateObj = new Date(entry.date);
  const jour = jours[dateObj.getDay()];
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => {
    setIsEditing(false);
    setEditScore(localEntry.mood_score);
    setEditPositive1(localEntry.positive1);
    setEditPositive2(localEntry.positive2);
    setEditPositive3(localEntry.positive3);
    setEditAnswer(localEntry.answer);
    setEditComment(localEntry.comment);
  };
  const handleSave = () => {
    setLocalEntry((prev) => ({
      ...prev,
      mood_score: editScore,
      positive1: editPositive1,
      positive2: editPositive2,
      positive3: editPositive3,
      answer: editAnswer,
      comment: editComment,
    }));
    setIsEditing(false);
  };

  return (
    <li className="mb-6 rounded  min-w-[250px] max-w-xs flex-1 border border-gray-200">
      {/* Header grisé */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-t">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">
            {jour.charAt(0).toUpperCase() + jour.slice(1)} {dd}.{mm}
          </h2>
          <span className="text-lg">{localEntry.mood_emoji}</span>
          <span className="px-2 py-1 rounded bg-sky-50 text-sm font-semibold">
            {localEntry.mood_score}
          </span>
        </div>
        <EditDeleteActions
          isEditing={isEditing}
          onEdit={handleEdit}
          onDelete={() => onDelete(entry.id)}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
      {/* Contenu blanc */}
      <div className="p-4">
        {/* Positives */}
        <div className="mb-1 text-sm break-words hyphens-auto">
          {isEditing ? (
            <textarea
              ref={positive1Ref}
              className="border rounded px-2 py-1 w-full mb-1 resize-y"
              value={editPositive1}
              onChange={(e) => {
                setEditPositive1(e.target.value);
                autoResize(e.target);
              }}
              onFocus={(e) => autoResize(e.target)}
              placeholder="+ Positive 1"
              rows={1}
              style={{ overflow: "hidden" }}
            />
          ) : (
            <>+ {localEntry.positive1}</>
          )}
        </div>
        <div className="mb-1 text-sm break-words hyphens-auto">
          {isEditing ? (
            <textarea
              ref={positive2Ref}
              className="border rounded px-2 py-1 w-full mb-1 resize-y"
              value={editPositive2}
              onChange={(e) => {
                setEditPositive2(e.target.value);
                autoResize(e.target);
              }}
              onFocus={(e) => autoResize(e.target)}
              placeholder="+ Positive 2"
              rows={1}
              style={{ overflow: "hidden" }}
            />
          ) : (
            <>+ {localEntry.positive2}</>
          )}
        </div>
        <div className="mb-1 text-sm break-words hyphens-auto">
          {isEditing ? (
            <textarea
              ref={positive3Ref}
              className="border rounded px-2 py-1 w-full mb-1 resize-y"
              value={editPositive3}
              onChange={(e) => {
                setEditPositive3(e.target.value);
                autoResize(e.target);
              }}
              onFocus={(e) => autoResize(e.target)}
              placeholder="+ Positive 3"
              rows={1}
              style={{ overflow: "hidden" }}
            />
          ) : (
            <>+ {localEntry.positive3}</>
          )}
        </div>
        {/* Question du jour */}
        {localEntry.question && (
          <div className="mt-2 text-gray-800 text-sm font-semibold">
            Question du jour : <span>{localEntry.question}</span>
          </div>
        )}
        {/* Réponse à la question : éditable uniquement si présente */}
        {localEntry.answer && (
          <div className="mb-1 ml-2 italic text-sky-900 text-sm">
            ↳{" "}
            {isEditing ? (
              <textarea
                ref={answerRef}
                className="border rounded px-2 py-1 w-full resize-y"
                value={editAnswer}
                onChange={(e) => {
                  setEditAnswer(e.target.value);
                  autoResize(e.target);
                }}
                onFocus={(e) => autoResize(e.target)}
                placeholder="Réponse à la question"
                rows={1}
                style={{ overflow: "hidden" }}
              />
            ) : (
              localEntry.answer
            )}
          </div>
        )}
        {/* Commentaire : modifiable uniquement si présent */}
        {localEntry.comment && (
          <div className="mt-2 text-gray-800 text-sm font-semibold">
            Commentaire :{" "}
            {isEditing ? (
              <textarea
                ref={commentRef}
                className="font-normal text-gray-700 italic border rounded px-2 py-1 w-full mt-1 resize-y"
                value={editComment}
                onChange={(e) => {
                  setEditComment(e.target.value);
                  autoResize(e.target);
                }}
                onFocus={(e) => autoResize(e.target)}
                rows={2}
                style={{ overflow: "hidden" }}
              />
            ) : (
              <span className="font-normal text-gray-700 italic">
                {localEntry.comment}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
