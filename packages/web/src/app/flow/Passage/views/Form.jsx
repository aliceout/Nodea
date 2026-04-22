import { useState, useEffect } from "react";
import Button from "@/ui/atoms/base/Button";
import Input from "@/ui/atoms/form/Input";
import Textarea from "@/ui/atoms/form/Textarea";
import FormError from "@/ui/atoms/form/FormError";
import SuggestInput from "@/ui/atoms/form/SuggestInput";
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from "@/core/store/nodea-store";
import {
  createPassageEntry,
  listDistinctThreads,
} from "@/core/api/modules/passage-legacy";

export default function PassageForm({ moduleUserId: moduleUserIdProp }) {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const runtimeSid = modules?.passage?.moduleUserId ?? "";
  const moduleUserId = moduleUserIdProp || runtimeSid;

  const [thread, setThread] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [threadOptions, setThreadOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadThreads() {
      if (!mainKey || !moduleUserId) return;
      try {
        const list = await listDistinctThreads(moduleUserId, mainKey);
        if (!cancelled) setThreadOptions(list);
      } catch {
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
        "Erreur : cle de chiffrement absente. Reconnecte-toi pour pouvoir enregistrer."
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
      thread: thread.trim(),
      title: title.trim() || null,
      content: content.trim(),
    };

    setSaving(true);
    try {
      await createPassageEntry(moduleUserId, mainKey, payload);
      setTitle("");
      setContent("");
    } catch (err) {
      setError("Erreur lors de l'enregistrement : " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex flex-col max-w-2xl gap-5 mx-auto"
      onSubmit={handleSubmit}
    >
      <h1 className="text-2xl font-bold">Nouvelle entree</h1>
      {error ? <FormError message={error} /> : null}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="ex: Jour 3 - pourquoi c'etait juste"
      />
      <Textarea
        label="Texte"
        rows={8}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Note ton cheminement, tes raisons, ce que tu observes..."
      />
      <div className="flex gap-2 items-center justify-between">
        <SuggestInput
          value={thread}
          onChange={setThread}
          options={threadOptions}
          placeholder="ex: #SortieJob ou #Deuil"
          required
          label="Hashtag / histoire"
          legend="Choisis un hashtag existant ou cree-en un nouveau. Il sert a regrouper les entrees."
        />
        <Button
          variant="primary"
          type="submit"
          disabled={saving}
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
