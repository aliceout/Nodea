// frontend/src/modules/Passage/Form.jsx
import { useState } from "react";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Textarea from "@/components/common/Textarea";
import FormError from "@/components/common/FormError";

import { useMainKey } from "@/hooks/useMainKey"; // ← export nommé (fix)
import { useModulesRuntime } from "@/store/modulesRuntime";
import { createPassageEntry } from "./data/passageEntries";

// Récupère le sid (module_user_id) du module Passage depuis le runtime
function usePassageSid() {
  const modules = useModulesRuntime();
  return modules?.passage?.id || modules?.passage?.module_user_id || "";
}

export default function PassageForm({ moduleUserId: moduleUserIdProp }) {
  const { mainKey } = useMainKey(); // Uint8Array ou CryptoKey, OK pour encryptAESGCM :contentReference[oaicite:1]{index=1}
  const runtimeSid = usePassageSid();
  const moduleUserId = moduleUserIdProp || runtimeSid;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!mainKey) {
      setError("Clé principale absente.");
      return;
    }
    if (!moduleUserId) {
      setError("Identifiant de module (sid) introuvable.");
      return;
    }
    if (!content.trim()) {
      setError("Contenu requis.");
      return;
    }

    const payload = {
      type: "passage.entry",
      date: new Date().toISOString(),
      title: title.trim() || null,
      content: content.trim(),
    };

    setSaving(true);
    try {
      await createPassageEntry(moduleUserId, mainKey, payload);
      setTitle("");
      setContent("");
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="max-w-2xl space-y-3" onSubmit={handleSubmit}>
      {error ? <FormError message={error} /> : null}

      <Input
        label="Titre"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="ex: Jour 3 — Un peu plus de clarté"
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
