import { useState, type FormEvent } from 'react';
import {
  HABIT_CATEGORY_VALUES,
  HABIT_FREQUENCY_VALUES,
  type HabitsItemPayload,
} from '@nodea/shared';
import { useHabits } from '../hooks/useHabits';
import { toIsoDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import Select from '@/ui/atoms/dirk/Select';
import DateField from '@/ui/atoms/dirk/DateField';

// `new Date().toISOString().slice(0, 10)` returns the UTC calendar
// day, off by one for users east of UTC after their local evening.
// `toIsoDate(new Date())` reads the local year / month / day.
function today(): string {
  return toIsoDate(new Date());
}

export default function HabitsFormView() {
  const { t } = useI18n();
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
      setError(t('habits.form.errors.titleRequired'));
      return;
    }

    const targetNum = target.trim() ? Number(target.trim()) : undefined;
    if (targetNum != null && (!Number.isInteger(targetNum) || targetNum < 1)) {
      setError(t('habits.form.errors.targetInvalid'));
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
      setSuccess(t('habits.form.success'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('habits.form.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-xl space-y-4 py-6">
      <h1 className="text-2xl font-bold">{t('habits.form.title')}</h1>

      <label className="block">
        <span className="text-sm">{t('habits.form.fields.title')}</span>
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('habits.form.placeholders.title')}
          className="mt-1"
          required
        />
      </label>

      <div className="flex gap-3">
        <label className="flex-1 block">
          <span className="text-sm">{t('habits.form.fields.category')}</span>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as HabitsItemPayload['category'])}
            className="mt-1"
          >
            {HABIT_CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex-1 block">
          <span className="text-sm">{t('habits.form.fields.frequency')}</span>
          <Select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as HabitsItemPayload['frequency'])}
            className="mt-1"
          >
            {HABIT_FREQUENCY_VALUES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex gap-3">
        <label className="flex-1 block">
          <span className="text-sm">{t('habits.form.fields.target')}</span>
          <Input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={t('habits.form.placeholders.target')}
            className="mt-1"
          />
        </label>
        <label className="flex-1 block">
          <span className="text-sm">{t('habits.form.fields.duration')}</span>
          <Input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder={t('habits.form.placeholders.duration')}
            className="mt-1"
          />
        </label>
      </div>

      <div className="block">
        <label htmlFor="habit-start" className="text-sm">{t('habits.form.fields.startedAt')}</label>
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
        {saving ? t('common.states.adding') : t('common.actions.add')}
      </Button>
    </form>
  );
}
