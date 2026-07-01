/**
 * Cycle day form — log / edit a single day (spec §3).
 *
 * Inline panel opened from the calendar. Flow select, free symptoms
 * (comma-separated → array), notes. Persists through `cycleClient`
 * (create or update) and deletes an existing day. The opt-in fertility
 * block (BBT / mucus / LH) is out of P1 — added in P3.
 */
import { useState, type FormEvent } from 'react';
import {
  CYCLE_FLOW_VALUES,
  type CycleFlow,
  type CyclePayload,
} from '@nodea/shared';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { cycleClient } from '@/core/api/modules/cycle';
import type { ModuleClient } from '@/core/modules/use-module-client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Field from '@/ui/atoms/dirk/Field';
import Select from '@/ui/atoms/dirk/Select';
import Textarea from '@/ui/atoms/dirk/Textarea';
import FormError from '@/ui/dirk/forms/FormError';

interface Props {
  ctx: ModuleClient;
  date: string;
  existing: DecryptedRecord<CyclePayload> | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function CycleDayForm({ ctx, date, existing, onSaved, onCancel }: Props) {
  const { t, language } = useI18n();
  const p = existing?.payload;
  const [flow, setFlow] = useState<string>(p?.flow ?? '');
  const [symptoms, setSymptoms] = useState<string>((p?.symptoms ?? []).join(', '));
  const [notes, setNotes] = useState<string>(p?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayLabel = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00`));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: CyclePayload = {
      date,
      ...(flow ? { flow: flow as CycleFlow } : {}),
      symptoms: symptoms.split(',').map((s) => s.trim()).filter(Boolean),
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    try {
      if (existing) {
        await cycleClient.update(ctx.moduleUserId, ctx.mainKey, existing.id, payload);
      } else {
        await cycleClient.create(ctx.moduleUserId, ctx.mainKey, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cycle.form.saveFailed'));
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    setError(null);
    try {
      await cycleClient.remove(ctx.moduleUserId, ctx.mainKey, existing.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cycle.form.saveFailed'));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[var(--radius-md)] border border-hair bg-bg p-4">
      <h2 className="mb-3 text-sm font-semibold capitalize text-ink">{dayLabel}</h2>

      <label htmlFor="cycle-flow" className="mb-1 block text-[12px] font-medium text-muted">
        {t('cycle.form.flow.label')}
      </label>
      <Select
        id="cycle-flow"
        value={flow}
        onChange={(e) => setFlow(e.target.value)}
        className="mb-3"
      >
        <option value="">{t('cycle.form.flow.none')}</option>
        {CYCLE_FLOW_VALUES.map((v) => (
          <option key={v} value={v}>
            {t(`cycle.form.flow.${v}`)}
          </option>
        ))}
      </Select>

      <Field
        label={t('cycle.form.symptoms.label')}
        name="cycle-symptoms"
        value={symptoms}
        onChange={(e) => setSymptoms(e.target.value)}
        placeholder={t('cycle.form.symptoms.placeholder')}
      />

      <label htmlFor="cycle-notes" className="mb-1 block text-[12px] font-medium text-muted">
        {t('cycle.form.notes.label')}
      </label>
      <Textarea
        id="cycle-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="mb-3"
        autoGrow
      />

      <FormError id="cycle-form-error">{error}</FormError>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={busy}>
            {t('common.actions.save')}
          </Button>
          <Button type="button" variant="neutral" size="sm" onClick={onCancel} disabled={busy}>
            {t('common.actions.cancel')}
          </Button>
        </div>
        {existing ? (
          <Button type="button" variant="danger-ghost" size="sm" onClick={remove} disabled={busy}>
            {t('common.actions.delete')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
