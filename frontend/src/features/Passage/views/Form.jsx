// frontend/src/features/Passage/views/Form.jsx

import { useState, useEffect } from "react";
import Button from "@/ui/components/Button";
import Input from "@/ui/components/Input";
import Textarea from "@/ui/components/Textarea";
import FormError from "@/ui/components/FormError";
import SuggestInput from "@/ui/components/SuggestInput";
import { useStore } from "@/store/StoreProvider";
import { useModulesRuntime } from "@/store/modulesRuntime";
import {
  createPassageEntry,
  listDistinctThreads,
} from "@/core/api/modules/Passage";

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
    <form
      className="flex flex-col max-w-2xl gap-5 mx-auto"
      onSubmit={handleSubmit}
    >
      <h1 className="text-2xl font-bold">Nouvelle entrée</h1>
      {error ? <FormError message={error} /> : null}
      <Input
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
      <div className="flex gap-2 items-center justify-between">
        <SuggestInput
          value={thread}
          onChange={setThread}
          options={threadOptions}
          placeholder="ex: #SortieJob ou #Deuil…"
          required
          label="Hashtag / histoire"
          legend="Choisis un hashtag existant ou crée-en un nouveau. Il sert à regrouper les entrées."
        />
        <Button
          className="bg-nodea-sage-dark hover:bg-nodea-sage-darker"
          type="submit"
          disabled={saving}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
      {/* La légende est maintenant gérée par SuggestInput */}
    </form>
  );
}
