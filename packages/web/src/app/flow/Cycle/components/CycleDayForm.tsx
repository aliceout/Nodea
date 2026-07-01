/**
 * Cycle day form — inline composer, same posture as `MoodForm` /
 * `GoalForm` : the shared `MODULE_FORM_CARD` chrome + `FormError` +
 * `FormFooter`, mounted through `InlinePanel` above the views. Logs /
 * edits one day (spec §3) : flow, free symptoms, notes. The date is
 * pinned by the calendar day the user opened (not an editable field).
 * The opt-in fertility block (BBT / mucus / LH) is P3.
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
import { MODULE_FORM_CARD } from '@/ui/dirk/forms/constants';
import FormError from '@/ui/dirk/forms/FormError';
import FormFooter from '@/ui/dirk/forms/FormFooter';

type Rec = DecryptedRecord<CyclePayload>;

interface Props {
  ctx: ModuleClient;
  date: string;
  /** Existing record for this date, when editing. */
  initial: Rec | null;
  /** Saved record to splice into the list ; `null` = the day was deleted. */
  onSaved: (record: Rec | null) => void;
  onCancel: () => void;
}

export default function CycleDayForm({ ctx, date, initial, onSaved, onCancel }: Props) {
  const { t, language } = useI18n();
  const p = initial?.payload;
  const [flow, setFlow] = useState<string>(p?.flow ?? '');
  const [symptoms, setSymptoms] = useState<string>((p?.symptoms ?? []).join(', '));
  const [notes, setNotes] = useState<string>(p?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = initial !== null;

  const dayLabel = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00`));

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const payload: CyclePayload = {
      date,
      ...(flow ? { flow: flow as CycleFlow } : {}),
      symptoms: symptoms.split(',').map((s) => s.trim()).filter(Boolean),
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    try {
      const record = initial
        ? await cycleClient.update(ctx.moduleUserId, ctx.mainKey, initial.id, payload)
        : await cycleClient.create(ctx.moduleUserId, ctx.mainKey, payload);
      onSaved(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cycle.form.saveFailed'));
      setSubmitting(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!initial || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await cycleClient.remove(ctx.moduleUserId, ctx.mainKey, initial.id);
      onSaved(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cycle.form.saveFailed'));
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void handleSave();
      }}
      className={MODULE_FORM_CARD}
      noValidate
    >
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

      {isEdit ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="danger-ghost"
            size="sm"
            onClick={() => void handleDelete()}
            disabled={submitting}
          >
            {t('common.actions.delete')}
          </Button>
        </div>
      ) : null}

      <FormFooter
        onCancel={onCancel}
        submitting={submitting}
        submitLabel={
          submitting
            ? t('common.states.saving')
            : isEdit
              ? t('common.actions.update')
              : t('common.actions.save')
        }
      />
    </form>
  );
}
