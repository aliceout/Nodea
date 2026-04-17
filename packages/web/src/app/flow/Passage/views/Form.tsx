import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { passageClient } from '@/core/api/modules/passage';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { PassagePayload } from '@nodea/shared';

/**
 * Minimal Passage entry — thread + optional title + content.
 */
export default function PassageFormView() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const navigate = useNavigate();
  const moduleUserId = modules.passage?.moduleUserId ?? null;

  const [thread, setThread] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!mainKey) {
      setError('Clé principale absente — reconnecte-toi.');
      return;
    }
    if (!moduleUserId) {
      setError("Le module Passage n'est pas activé (Paramètres → Modules).");
      return;
    }
    if (!content.trim()) {
      setError('Le contenu ne peut pas être vide.');
      return;
    }

    const payload: PassagePayload = {
      type: 'passage.entry',
      date: new Date().toISOString(),
      thread: thread.trim(),
      title: title.trim() || null,
      content: content.trim(),
    };

    setSaving(true);
    try {
      await passageClient.create(moduleUserId, mainKey, payload);
      navigate('.');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
      if (import.meta.env.DEV) console.warn('passage create failed', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4 py-6">
      <h1 className="text-lg font-semibold">Nouveau passage</h1>

      <label className="block">
        <span className="text-sm">Thread (optionnel)</span>
        <input
          type="text"
          value={thread}
          onChange={(e) => setThread(e.target.value)}
          className="mt-1 block w-full rounded border border-slate-300 p-2"
        />
      </label>

      <label className="block">
        <span className="text-sm">Titre (optionnel)</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded border border-slate-300 p-2"
        />
      </label>

      <label className="block">
        <span className="text-sm">Contenu *</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          required
          className="mt-1 block w-full rounded border border-slate-300 p-2"
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  );
}
