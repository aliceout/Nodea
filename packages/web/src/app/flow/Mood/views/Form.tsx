import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { moodClient } from '@/core/api/modules/mood';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { MoodPayload } from '@nodea/shared';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Minimal Mood entry form.
 *
 * Drops the legacy emoji picker + random-question + three positives
 * UI in favour of a clean MVP: date, mood score (0–10), and an
 * optional comment. The richer editorial surface will come back on
 * top of this once the crypto + round-trip are exercised in
 * production.
 */
export default function MoodFormView() {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const navigate = useNavigate();
  const moduleUserId = modules.mood?.moduleUserId ?? null;

  const [date, setDate] = useState<string>(today());
  const [score, setScore] = useState<string>('5');
  const [emoji, setEmoji] = useState<string>('🙂');
  const [comment, setComment] = useState<string>('');
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
      setError("Le module Mood n'est pas activé (Paramètres → Modules).");
      return;
    }

    const payload: MoodPayload = {
      date,
      mood_score: score,
      mood_emoji: emoji,
      positive1: '',
      positive2: '',
      positive3: '',
      comment,
    };

    setSaving(true);
    try {
      await moodClient.create(moduleUserId, mainKey, payload);
      navigate('.');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
      if (import.meta.env.DEV) console.warn('mood create failed', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4 py-6">
      <h1 className="text-lg font-semibold">Nouvelle entrée Mood</h1>

      <label className="block">
        <span className="text-sm">Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="mt-1 block w-full rounded border border-slate-300 p-2"
        />
      </label>

      <label className="block">
        <span className="text-sm">Humeur (0 = terrible, 10 = excellent)</span>
        <input
          type="number"
          min={0}
          max={10}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          required
          className="mt-1 block w-full rounded border border-slate-300 p-2"
        />
      </label>

      <label className="block">
        <span className="text-sm">Emoji</span>
        <input
          type="text"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          maxLength={4}
          className="mt-1 block w-20 rounded border border-slate-300 p-2 text-center text-xl"
        />
      </label>

      <label className="block">
        <span className="text-sm">Commentaire</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
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
