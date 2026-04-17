import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { goalsClient } from '@/core/api/modules/goals';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import { GOAL_STATUS_VALUES, type GoalsPayload } from '@nodea/shared';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Minimal Goals entry form — title, status, thread, note.
 * The richer edit-inline + thread autosuggest flow returns later.
 */
export default function GoalsFormView() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const navigate = useNavigate();
  const moduleUserId = modules.goals?.moduleUserId ?? null;

  const [date, setDate] = useState<string>(today());
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<GoalsPayload['status']>('active');
  const [thread, setThread] = useState('');
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
      setError("Le module Goals n'est pas activé (Paramètres → Modules).");
      return;
    }
    if (!title.trim()) {
      setError('Le titre est obligatoire.');
      return;
    }

    const payload: GoalsPayload = {
      date,
      title: title.trim(),
      note,
      status,
      thread: thread.trim(),
    };

    setSaving(true);
    try {
      await goalsClient.create(moduleUserId, mainKey, payload);
      navigate('.');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
      if (import.meta.env.DEV) console.warn('goals create failed', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4 py-6">
      <h1 className="text-lg font-semibold">Nouvel objectif</h1>

      <label className="block">
        <span className="text-sm">Titre *</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1 block w-full rounded border border-slate-300 p-2"
        />
      </label>

      <label className="block">
        <span className="text-sm">Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block w-full rounded border border-slate-300 p-2"
        />
      </label>

      <label className="block">
        <span className="text-sm">Statut</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as GoalsPayload['status'])}
          className="mt-1 block w-full rounded border border-slate-300 p-2"
        >
          {GOAL_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

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
        <span className="text-sm">Note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
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
