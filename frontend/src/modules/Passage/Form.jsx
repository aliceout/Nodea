// frontend/src/modules/Passage/Form.jsx
import { useEffect, useState } from "react";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Textarea from "@/components/common/Textarea";
import FormError from "@/components/common/FormError";

import { useStore } from "@/store/StoreProvider";
import { useModulesRuntime } from "@/store/modulesRuntime";
import { createPassageEntry, listDistinctThreads } from "./data/passageEntries";

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
    <form className="max-w-2xl space-y-3" onSubmit={handleSubmit}>
      <h1 className="text-2xl font-bold mb-4">Nouvelle entrée</h1>
      {error ? <FormError message={error} /> : null}{" "}
      <div className="space-y-1">
        <label
          htmlFor="passage-thread"
          className="text-sm font-medium text-gray-700"
        >
          Hashtag / histoire <span className="text-red-600">*</span>
        </label>
        <input
          id="passage-thread"
          list="passage-thread-options"
          className="border border-gray-300 rounded px-3 py-2 w-full"
          value={thread}
          onChange={(e) => setThread(e.target.value)}
          placeholder="ex: #SortieJob ou #Deuil…"
          required
        />
        <datalist id="passage-thread-options">
          {threadOptions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <p className="text-xs text-gray-500">
          Choisis un hashtag existant ou crée-en un nouveau. Il sert à regrouper
          les entrées.
        </p>
      </div>
      <Input
        label="Titre (optionnel)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="ex: Jour 3 — pourquoi c'était juste"
      />
      <Textarea
        label="Texte"
        rows={8}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Note ton cheminement, tes raisons, ce que tu observes…"
      />
      <div>
        <Button
          className="bg-nodea-sage-dark hover:bg-nodea-sage-darker"
          type="submit"
          disabled={saving}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
