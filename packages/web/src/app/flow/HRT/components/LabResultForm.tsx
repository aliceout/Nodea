/**
 * HRT · Analyses — create / edit form for one lab reading.
 *
 * Same shape as `AdminLogForm` : RHF + Zod resolver on the shared
 * `HrtLabResultPayloadSchema`, persistence injected via `onSubmit`.
 *
 * Marker pick = a real `<Select>` (shows the label, stores the preset
 * **key** so the chart's unit conversion can resolve it) with an
 * « Autre… » escape to a free-text input for markers not in the
 * presets. A `<datalist>` was rejected : it writes the option *value*
 * (the key) into the field, so users saw « Œstradiol (E2) » in the
 * list but « estradiol » landing in the box.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import {
  HRT_DRAW_CONTEXT_VALUES,
  HRT_MARKERS,
  HrtLabResultPayloadSchema,
  findMarker,
  type HrtLabResultPayload,
} from '@nodea/shared';

import Button from '@/ui/atoms/dirk/Button';
import DateField from '@/ui/atoms/dirk/DateField';
import Input from '@/ui/atoms/dirk/Input';
import Select from '@/ui/atoms/dirk/Select';
import Textarea from '@/ui/atoms/dirk/Textarea';

import { HRT_DRAW_CONTEXT_LABELS, todayIso } from '../lib/labels';
import type { LabResultEntry } from '../hooks/use-lab-results';
import FieldRow from './FieldRow';
import TextField from './TextField';

type FormIn = z.input<typeof HrtLabResultPayloadSchema>;
type FormOut = z.output<typeof HrtLabResultPayloadSchema>;

const COMMON_UNITS = [
  'pg/mL',
  'pmol/L',
  'ng/dL',
  'nmol/L',
  'ng/mL',
  'IU/L',
  'mIU/L',
  'µg/L',
  'mmol/L',
  'µmol/L',
  'g/dL',
  '%',
];

interface LabResultFormProps {
  initial?: LabResultEntry;
  onSubmit: (payload: HrtLabResultPayload, id?: string) => Promise<void>;
  onClose: () => void;
}

export default function LabResultForm({ initial, onSubmit, onClose }: LabResultFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(HrtLabResultPayloadSchema),
    defaultValues: initial?.payload ?? {
      date: todayIso(),
      marker: '',
      unit: '',
      context: 'unknown',
      lab: '',
      notes: '',
      updatedAt: '',
    },
  });

  // The unit options follow the chosen marker : a known preset narrows
  // to its units (e.g. estradiol → pg/mL | pmol/L), an unknown / free
  // marker falls back to the common list. An edit value that isn't in
  // the list is kept as an extra option so nothing is lost.
  const markerVal = watch('marker') ?? '';
  const unitVal = watch('unit') ?? '';
  const preset = findMarker(markerVal);
  const unitOptions = preset ? preset.units : COMMON_UNITS;
  const showCurrentUnit = unitVal !== '' && !unitOptions.includes(unitVal);

  // Marker picker mode : a preset `<Select>` by default, or a free-text
  // input once the user picks « Autre… » (or when editing a marker that
  // isn't in the presets).
  const [customMarker, setCustomMarker] = useState(() => markerVal !== '' && !preset);
  // In preset mode the Select is controlled (not RHF-registered) — its
  // value is the marker key when known, else blank.
  const presetSelectValue = preset ? markerVal : '';

  function onPresetChange(value: string): void {
    if (value === '__custom__') {
      setCustomMarker(true);
      setValue('marker', '', { shouldValidate: false });
      setValue('unit', '', { shouldValidate: false });
      return;
    }
    setValue('marker', value, { shouldValidate: true });
    const p = findMarker(value);
    if (p) setValue('unit', p.canonicalUnit, { shouldValidate: true });
  }

  async function onValid(values: FormOut): Promise<void> {
    setServerError(null);
    const payload: HrtLabResultPayload = {
      ...values,
      updatedAt: new Date().toISOString(),
    };
    try {
      await onSubmit(payload, initial?.id);
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className="rounded-md border border-hair bg-bg-2 p-4"
      noValidate
    >
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <FieldRow label="Date" htmlFor="hrt-lab-date" error={errors.date?.message}>
          <DateField
            id="hrt-lab-date"
            value={watch('date') ?? ''}
            onChange={(iso) => setValue('date', iso, { shouldValidate: true })}
            {...(errors.date ? { ariaInvalid: true } : {})}
          />
        </FieldRow>

        <FieldRow label="Marqueur" htmlFor="hrt-marker" error={errors.marker?.message}>
          {customMarker ? (
            <div className="flex gap-2">
              <Input
                id="hrt-marker"
                placeholder="marqueur personnalisé…"
                {...register('marker')}
              />
              <Button
                type="button"
                variant="neutral"
                size="sm"
                onClick={() => {
                  setCustomMarker(false);
                  setValue('marker', '', { shouldValidate: false });
                }}
              >
                Liste
              </Button>
            </div>
          ) : (
            <Select
              id="hrt-marker"
              value={presetSelectValue}
              onChange={(e) => onPresetChange(e.target.value)}
            >
              <option value="" disabled>
                Choisir un marqueur…
              </option>
              {HRT_MARKERS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
              <option value="__custom__">Autre…</option>
            </Select>
          )}
        </FieldRow>

        <TextField
          label="Valeur"
          type="number"
          step="any"
          inputMode="decimal"
          placeholder="165"
          error={errors.value?.message}
          {...register('value', { valueAsNumber: true })}
        />
        <FieldRow label="Unité" htmlFor="hrt-lab-unit" error={errors.unit?.message}>
          <Select id="hrt-lab-unit" {...register('unit')}>
            <option value="" disabled>
              Unité…
            </option>
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
            {showCurrentUnit ? <option value={unitVal}>{unitVal}</option> : null}
          </Select>
        </FieldRow>

        <FieldRow label="Prélèvement" htmlFor="hrt-context" error={errors.context?.message}>
          <Select id="hrt-context" {...register('context')}>
            {HRT_DRAW_CONTEXT_VALUES.map((c) => (
              <option key={c} value={c}>
                {HRT_DRAW_CONTEXT_LABELS[c]}
              </option>
            ))}
          </Select>
        </FieldRow>

        <TextField
          label="Labo (optionnel)"
          placeholder="Cerballiance…"
          error={errors.lab?.message}
          {...register('lab')}
        />
      </div>

      <FieldRow label="Notes (optionnel)" htmlFor="hrt-lab-notes" error={errors.notes?.message}>
        <Textarea id="hrt-lab-notes" minHeightPx={56} {...register('notes')} />
      </FieldRow>

      {serverError ? (
        <p role="alert" className="mb-3 text-[12px] text-danger">
          {serverError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="neutral" size="sm" onClick={onClose} disabled={isSubmitting}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {initial ? 'Enregistrer' : 'Ajouter'}
        </Button>
      </div>
    </form>
  );
}
