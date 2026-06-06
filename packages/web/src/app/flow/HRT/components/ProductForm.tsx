/**
 * HRT · Products — create / edit form for one catalog product.
 *
 * RHF + Zod resolver on the shared `HrtProductPayloadSchema`. A product
 * carries everything an administration needs : molecule, category,
 * route, dose unit and (for injectables) concentration. Picking a
 * molecule from the presets seeds category / route / unit ; « Autre… »
 * falls back to free text. Persistence is injected via `onSubmit`.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import {
  HRT_CATEGORY_VALUES,
  HRT_MEDICATIONS,
  HRT_ROUTE_VALUES,
  HrtProductPayloadSchema,
  type HrtProductPayload,
} from '@nodea/shared';

import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import Select from '@/ui/atoms/dirk/Select';
import Textarea from '@/ui/atoms/dirk/Textarea';

import { HRT_CATEGORY_LABELS, HRT_ROUTE_LABELS } from '../lib/labels';
import type { ProductEntry } from '../data/use-products';
import FieldRow from './FieldRow';
import TextField from './TextField';

type FormIn = z.input<typeof HrtProductPayloadSchema>;
type FormOut = z.output<typeof HrtProductPayloadSchema>;

const DOSE_UNITS = ['mg', 'mL', 'µg', 'µg/24h', 'UI', 'pression', 'comprimé', 'goutte'];

const numFromInput = (v: unknown): number | undefined =>
  v === '' || v == null ? undefined : Number(v);

interface ProductFormProps {
  initial?: ProductEntry;
  onSubmit: (payload: HrtProductPayload, id?: string) => Promise<void>;
  onClose: () => void;
}

export default function ProductForm({ initial, onSubmit, onClose }: ProductFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(HrtProductPayloadSchema),
    defaultValues: initial?.payload ?? {
      name: '',
      medication: '',
      category: 'estrogen',
      route: 'oral',
      unit: 'mg',
      notes: '',
      updatedAt: '',
    },
  });

  const medVal = watch('medication') ?? '';
  const unitVal = watch('unit') ?? '';
  const categoryVal = watch('category') ?? 'other';
  // Category is the driver : the molecule picker only lists molecules of
  // the chosen category.
  const medsForCategory = HRT_MEDICATIONS.filter((m) => m.category === categoryVal);
  const isPresetMed = HRT_MEDICATIONS.some((m) => m.label === medVal);
  const [customMed, setCustomMed] = useState(() => medVal !== '' && !isPresetMed);
  const medSelectValue = medsForCategory.some((m) => m.label === medVal) ? medVal : '';
  const showCurrentUnit = unitVal !== '' && !DOSE_UNITS.includes(unitVal);

  function onMedChange(value: string): void {
    if (value === '__custom__') {
      setCustomMed(true);
      setValue('medication', '', { shouldValidate: false });
      return;
    }
    setValue('medication', value, { shouldValidate: true });
    const m = HRT_MEDICATIONS.find((x) => x.label === value);
    if (m) {
      setValue('route', m.defaultRoute, { shouldValidate: true });
      setValue('unit', m.defaultUnit, { shouldValidate: true });
    }
  }

  async function onValid(values: FormOut): Promise<void> {
    setServerError(null);
    const payload: HrtProductPayload = { ...values, updatedAt: new Date().toISOString() };
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
        <TextField
          label="Nom du fournisseur"
          placeholder="ex. Préparation magistrale, Aldactone…"
          error={errors.name?.message}
          {...register('name')}
        />

        <FieldRow label="Catégorie" htmlFor="hrt-p-category" error={errors.category?.message}>
          <Select
            id="hrt-p-category"
            {...register('category', {
              onChange: () => {
                // Molecules are category-scoped — reset the choice so the
                // picker can't keep an out-of-category molecule.
                setCustomMed(false);
                setValue('medication', '', { shouldValidate: false });
              },
            })}
          >
            {HRT_CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>
                {HRT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </FieldRow>

        <FieldRow label="Molécule" htmlFor="hrt-p-medication" error={errors.medication?.message}>
          {customMed ? (
            <div className="flex gap-2">
              <Input
                id="hrt-p-medication"
                placeholder="molécule personnalisée…"
                {...register('medication')}
              />
              <Button
                type="button"
                variant="neutral"
                size="sm"
                onClick={() => {
                  setCustomMed(false);
                  setValue('medication', '', { shouldValidate: false });
                }}
              >
                Liste
              </Button>
            </div>
          ) : (
            <Select
              id="hrt-p-medication"
              value={medSelectValue}
              onChange={(e) => onMedChange(e.target.value)}
            >
              <option value="" disabled>
                Choisir une molécule…
              </option>
              {medsForCategory.map((m) => (
                <option key={m.id} value={m.label}>
                  {m.label}
                </option>
              ))}
              <option value="__custom__">Autre…</option>
            </Select>
          )}
        </FieldRow>

        <FieldRow label="Voie" htmlFor="hrt-p-route" error={errors.route?.message}>
          <Select id="hrt-p-route" {...register('route')}>
            {HRT_ROUTE_VALUES.map((r) => (
              <option key={r} value={r}>
                {HRT_ROUTE_LABELS[r]}
              </option>
            ))}
          </Select>
        </FieldRow>

        <FieldRow label="Unité de dose" htmlFor="hrt-p-unit" error={errors.unit?.message}>
          <Select id="hrt-p-unit" {...register('unit')}>
            {DOSE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
            {showCurrentUnit ? <option value={unitVal}>{unitVal}</option> : null}
          </Select>
        </FieldRow>

        <TextField
          label="Concentration (mg/mL, optionnel)"
          type="number"
          step="any"
          inputMode="decimal"
          placeholder="10"
          error={errors.concentration?.message}
          {...register('concentration', { setValueAs: numFromInput })}
        />
      </div>

      <FieldRow label="Notes (optionnel)" htmlFor="hrt-p-notes" error={errors.notes?.message}>
        <Textarea id="hrt-p-notes" minHeightPx={56} {...register('notes')} />
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
