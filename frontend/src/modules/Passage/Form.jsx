// frontend/src/modules/Passage/Form.jsx
import { useRef, useState, useEffect } from "react";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Textarea from "@/components/common/Textarea";
import FormError from "@/components/common/FormError";

import { useStore } from "@/store/StoreProvider";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { createPassageEntry, listDistinctThreads } from "@/services/dataModules/Passage";

// Récupère le sid (module_user_id) du module Passage depuis le runtime
function usePassageSid() {
  const modules = useModulesRuntime();
  return modules?.passage?.id || modules?.passage?.module_user_id || "";
}

export default function PassageForm({ moduleUserId: moduleUserIdProp }) {
  const { mainKey } = useStore();
  const runtimeSid = usePassageSid();
  const moduleUserId = moduleUserIdProp || runtimeSid;

  const [thread, setThread] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [threadOptions, setThreadOptions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!thread) {
      setFilteredSuggestions(threadOptions);
    } else {
      setFilteredSuggestions(
        threadOptions.filter((t) =>
          t.toLowerCase().includes(thread.toLowerCase())
        )
      );
    }
  }, [thread, threadOptions]);

  // Charger suggestions de threads existants (si mainKey + sid présents)
  useEffect(() => {
    let cancelled = false;
    async function loadThreads() {
      if (!mainKey || !moduleUserId) return;
      try {
        const list = await listDistinctThreads(moduleUserId, mainKey, {
          pages: 2,
          perPage: 100,
        });
        if (!cancelled) setThreadOptions(list);
      } catch (_) {
        if (!cancelled) setThreadOptions([]);
      }
    }
    loadThreads();
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!mainKey) {
      setError(
        "Erreur : clé de chiffrement absente. Reconnecte-toi pour pouvoir enregistrer."
      );
      return;
    }
    if (!moduleUserId) {
      setError("Identifiant de module (sid) introuvable.");
      return;
    }
    if (!thread.trim()) {
      setError("Le hashtag / histoire est requis.");
      return;
    }
    if (!content.trim()) {
      setError("Contenu requis.");
      return;
    }

    const payload = {
      type: "passage.entry",
      date: new Date().toISOString(),
      thread: thread.trim(), // ← OBLIGATOIRE
      title: title.trim() || null,
      content: content.trim(),
    };

    setSaving(true);
    try {
      await createPassageEntry(moduleUserId, mainKey, payload);
      // reset minimal
      setTitle("");
      setContent("");
      // garder thread sélectionné pour enchaîner plusieurs entrées
    } catch (err) {
      setError("Erreur lors de l’enregistrement : " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="max-w-2xl space-y-3 mx-auto" onSubmit={handleSubmit}>
      <h1 className="text-2xl font-bold mb-4">Nouvelle entrée</h1>
      {error ? <FormError message={error} /> : null}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="ex: Jour 3 — pourquoi c'était juste"
        className="text-sm"
      />
      <Textarea
        label="Texte"
        rows={8}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Note ton cheminement, tes raisons, ce que tu observes…"
      />
      <div className="flex gap-2 items-center justify-between">
        <div className="w-full">
          <div className="relative">
            <input
              id="passage-thread"
              ref={inputRef}
              className="border border-gray-300 rounded px-3 py-2 w-full pr-8 bg-white appearance-none focus:ring-2 focus:ring-nodea-sage-dark text-sm"
              value={thread}
              onChange={(e) => {
                setThread(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="ex: #SortieJob ou #Deuil…"
              required
              autoComplete="off"
            />
            {/* Flèche visuelle */}
            <svg
              className="pointer-events-none absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 20 20"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 8l4 4 4-4"
              />
            </svg>
            {showSuggestions && filteredSuggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded shadow-lg text-xs max-h-48 overflow-auto">
                {filteredSuggestions.map((t) => (
                  <li
                    key={t}
                    className="px-3 py-2 text-gray-700 cursor-pointer hover:bg-nodea-sage-light"
                    onMouseDown={() => {
                      setThread(t);
                      setShowSuggestions(false);
                      inputRef.current.blur();
                    }}
                  >
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex items-end">
          <Button
            className="bg-nodea-sage-dark hover:bg-nodea-sage-darker"
            type="submit"
            disabled={saving}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Choisis un hashtag existant ou crée-en un nouveau. Il sert à regrouper
        les entrées.
      </p>
    </form>
  );
}
