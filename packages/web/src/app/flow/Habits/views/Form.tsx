import { useState, type FormEvent } from 'react';
import {
  HABIT_CATEGORY_VALUES,
  HABIT_FREQUENCY_VALUES,
  type HabitsItemPayload,
} from '@nodea/shared';
import { useHabits } from '../hooks/useHabits';
import Button from '@/ui/atoms/dirk/Button';
import DateField from '@/ui/atoms/dirk/DateField';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HabitsFormView() {
  const { ready, createItem } = useHabits();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<HabitsItemPayload['category']>('autre');
  const [frequency, setFrequency] = useState<HabitsItemPayload['frequency']>('weekly');
  const [target, setTarget] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [startedAt, setStartedAt] = useState<string>(today());
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!title.trim()) {
      setError('Donne un titre à cette habitude.');
      return;
    }

    const targetNum = target.trim() ? Number(target.trim()) : undefined;
    if (targetNum != null && (!Number.isInteger(targetNum) || targetNum < 1)) {
      setError('Cible invalide : un entier positif attendu.');
      return;
    }

    const payload: HabitsItemPayload = {
      title: title.trim(),
      category,
      frequency,
      startedAt: startedAt || today(),
      archived: false,
      ...(targetNum != null ? { target: targetNum } : {}),
      ...(duration.trim() ? { duration: duration.trim() } : {}),
    };

    setSaving(true);
    try {
      await createItem(payload);
      setTitle('');
      setTarget('');
      setDuration('');
      setSuccess('Habitude ajoutée.');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-xl space-y-4 py-6">
      <h1 className="text-2xl font-bold">Nouvelle habitude</h1>

      <label className="block">
        <span className="text-sm">Titre</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex. Tennis"
          className="mt-1 block w-full rounded border border-slate-300 p-2"
          required
        />
      </label>

      <div className="flex gap-3">
        <label className="flex-1 block">
          <span className="text-sm">Catégorie</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as HabitsItemPayload['category'])}
            className="mt-1 block w-full rounded border border-slate-300 p-2"
          >
            {HABIT_CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 block">
          <span className="text-sm">Fréquence</span>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as HabitsItemPayload['frequency'])}
            className="mt-1 block w-full rounded border border-slate-300 p-2"
          >
            {HABIT_FREQUENCY_VALUES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-3">
        <label className="flex-1 block">
          <span className="text-sm">Cible (optionnel)</span>
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="ex. 1 / semaine"
            className="mt-1 block w-full rounded border border-slate-300 p-2"
          />
        </label>
        <label className="flex-1 block">
          <span className="text-sm">Durée prévue (ISO 8601)</span>
          <input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="ex. P6M"
            className="mt-1 block w-full rounded border border-slate-300 p-2"
          />
        </label>
      </div>

      <div className="block">
        <label htmlFor="habit-start" className="text-sm">Date de début</label>
        <DateField id="habit-start" value={startedAt} onChange={setStartedAt} className="mt-1" />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={!ready || saving || !title.trim()}
      >
        {saving ? 'Ajout…' : 'Ajouter'}
      </Button>
    </form>
  );
}
