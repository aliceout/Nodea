/**
 * HRT · Administration — create / edit form for a recurring dose
 * schedule (« prise récurrente »).
 *
 * Same shape as `AdminLogForm` (catalog-only product picker + dose), with
 * a frequency (every day / every N days), a start date, and no single
 * date — the generator materialises one real `HrtAdminLog` per occurrence
 * (see `hooks/use-schedule-materialization`). RHF + Zod resolver on the
 * shared `HrtSchedulePayloadSchema`. The « + Nouveau produit » quick-add
 * inlines `ProductForm`, exactly like the manual form.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import {
  HRT_CATEGORY_VALUES,
  HrtSchedulePayloadSchema,
  type HrtProductPayload,
  type HrtSchedulePayload,
} from '@nodea/shared';

import Button from '@/ui/atoms/dirk/Button';
import DateField from '@/ui/atoms/dirk/DateField';
import Select from '@/ui/atoms/dirk/Select';
import Textarea from '@/ui/atoms/dirk/Textarea';

import { HRT_CATEGORY_LABELS, todayIso } from '../lib/labels';
import type { ScheduleEntry } from '../hooks/use-schedules';
import type { ProductOption } from './AdminLogForm';
import FieldRow from './FieldRow';
import ProductForm from './ProductForm';
import TextField from './TextField';

type FormIn = z.input<typeof HrtSchedulePayloadSchema>;
type FormOut = z.output<typeof HrtSchedulePayloadSchema>;

const SPINNER_HIDE =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:[-webkit-appearance:none] [&::-webkit-outer-spin-button]:[-webkit-appearance:none] [&::-webkit-inner-spin-button]:m-0';

interface ScheduleFormProps {
  initial?: ScheduleEntry;
  products: ReadonlyArray<ProductOption>;
  onSubmit: (payload: HrtSchedulePayload, id?: string) => Promise<void>;
  onCreateProduct: (payload: HrtProductPayload) => Promise<void>;
  onClose: () => void;
}

export default function ScheduleForm({
  initial,
  products,
  onSubmit,
  onCreateProduct,
  onClose,
}: ScheduleFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(HrtSchedulePayloadSchema),
    defaultValues: initial?.payload ?? {
      product: '',
      frequency: 'daily',
      time: '',
      startDate: todayIso(),
      endDate: null,
      materializedThrough: '',
      notes: '',
      updatedAt: '',
    },
  });

  const productVal = watch('product') ?? '';
  const frequency = watch('frequency') ?? 'daily';
  const selected = products.find((p) => p.name === productVal);
  const doseUnit = selected?.unit ?? '';
  const doseLabel = doseUnit ? `Dose (${doseUnit})` : 'Dose';
  const categories = HRT_CATEGORY_VALUES.filter((c) => products.some((p) => p.category === c));

  async function onValid(values: FormOut): Promise<void> {
    setServerError(null);
    const payload: HrtSchedulePayload = { ...values, updatedAt: new Date().toISOString() };
    // Daily schedules carry no interval — drop a stale value.
    if (payload.frequency !== 'every_n_days') delete payload.everyNDays;
    try {
      await onSubmit(payload, initial?.id);
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  if (addingProduct) {
    return (
      <ProductForm
        onSubmit={async (p) => {
          await onCreateProduct(p);
          setValue('product', p.name, { shouldValidate: true });
        }}
        onClose={() => setAddingProduct(false)}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className="rounded-md border border-hair bg-bg-2 p-4"
      noValidate
    >
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[2fr_1fr_1fr]">
        <FieldRow label="Produit" htmlFor="hrt-sched-product" error={errors.product?.message}>
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <Select id="hrt-sched-product" {...register('product')}>
                <option value="" disabled>
                  {products.length === 0 ? 'Aucun produit enregistré' : 'Choisir un produit…'}
                </option>
                {categories.map((c) => (
                  <optgroup key={c} label={HRT_CATEGORY_LABELS[c]}>
                    {products
                      .filter((p) => p.category === c)
                      .map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                          {p.medication ? ` · ${p.medication}` : ''}
                          {typeof p.concentration === 'number' ? ` (${p.concentration} mg/mL)` : ''}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              onClick={() => setAddingProduct(true)}
            >
              + Nouveau produit
            </Button>
          </div>
        </FieldRow>

        <TextField
          label={doseLabel}
          type="number"
          step="any"
          inputMode="decimal"
          placeholder="0.4"
          className={SPINNER_HIDE}
          error={errors.dose?.message}
          {...register('dose', { valueAsNumber: true })}
        />

        <FieldRow label="Date de début" htmlFor="hrt-sched-start" error={errors.startDate?.message}>
          <DateField
            id="hrt-sched-start"
            value={watch('startDate') ?? ''}
            onChange={(iso) => setValue('startDate', iso, { shouldValidate: true })}
            {...(errors.startDate ? { ariaInvalid: true } : {})}
          />
        </FieldRow>
      </div>

      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[2fr_1fr_1fr]">
        <FieldRow label="Fréquence" htmlFor="hrt-sched-freq" error={errors.frequency?.message}>
          <Select id="hrt-sched-freq" {...register('frequency')}>
            <option value="daily">Tous les jours</option>
            <option value="every_n_days">Tous les N jours</option>
          </Select>
        </FieldRow>

        {frequency === 'every_n_days' ? (
          <TextField
            label="Intervalle (jours)"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="5"
            className={SPINNER_HIDE}
            error={errors.everyNDays?.message}
            {...register('everyNDays', { valueAsNumber: true })}
          />
        ) : null}
      </div>

      <FieldRow label="Notes (optionnel)" htmlFor="hrt-sched-notes" error={errors.notes?.message}>
        <Textarea id="hrt-sched-notes" minHeightPx={56} {...register('notes')} />
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
          {initial ? 'Enregistrer' : 'Lancer la série'}
        </Button>
      </div>
    </form>
  );
}
