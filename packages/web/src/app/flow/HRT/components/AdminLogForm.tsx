/**
 * HRT · Administration — create / edit form for one dose-log entry.
 *
 * Catalog-only : an administration just references a product (by name)
 * + a dose + a date/time. The molecule / route / dose unit /
 * concentration all live on the product, so the form is tiny. The
 * product `<Select>` is grouped by category ; a « + Nouveau produit »
 * quick-add inlines `ProductForm` so you never leave the dose entry.
 *
 * RHF + Zod resolver on the shared `HrtAdminLogPayloadSchema` ;
 * persistence (dose + product creation) injected by the caller.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import {
  HRT_CATEGORY_VALUES,
  HrtAdminLogPayloadSchema,
  type HrtAdminLogPayload,
  type HrtCategory,
  type HrtProductPayload,
} from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import DateField from '@/ui/atoms/dirk/DateField';
import Input from '@/ui/atoms/dirk/Input';
import Select from '@/ui/atoms/dirk/Select';
import Textarea from '@/ui/atoms/dirk/Textarea';
import { FORM_CARD } from '@/ui/dirk/forms/constants';

import { categoryLabel, todayIso } from '../lib/labels';
import { doseUnitOf, mgEquivalent } from '../lib/export-model';
import type { AdminLogEntry } from '../hooks/use-admin-logs';
import FieldRow from './FieldRow';
import ProductForm from './ProductForm';

type FormIn = z.input<typeof HrtAdminLogPayloadSchema>;
type FormOut = z.output<typeof HrtAdminLogPayloadSchema>;

export interface ProductOption {
  name: string;
  medication?: string;
  category: HrtCategory;
  unit: string;
  concentration?: number;
}

interface AdminLogFormProps {
  /** When set, the form edits this entry instead of creating one. */
  initial?: AdminLogEntry;
  /** The catalog the dose references. Grouped by category in the picker. */
  products: ReadonlyArray<ProductOption>;
  /** Persist the entry. `id` is set on edit. */
  onSubmit: (payload: HrtAdminLogPayload, id?: string) => Promise<void>;
  /** Create a product from the inline quick-add. */
  onCreateProduct: (payload: HrtProductPayload) => Promise<void>;
  /** Close the form (cancel, or after a successful submit). */
  onClose: () => void;
}

export default function AdminLogForm({
  initial,
  products,
  onSubmit,
  onCreateProduct,
  onClose,
}: AdminLogFormProps) {
  const { t } = useI18n();
  const [serverError, setServerError] = useState<string | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(HrtAdminLogPayloadSchema),
    defaultValues: initial?.payload ?? {
      date: todayIso(),
      time: '',
      product: '',
      notes: '',
      updatedAt: '',
    },
  });

  const productVal = watch('product') ?? '';
  const selected = products.find((p) => p.name === productVal);
  // A product with a mg/mL concentration is dosed by volume → ask mL ; the
  // conversion is per prise, derived from the product's concentration.
  const doseUnit = doseUnitOf(selected);
  const doseLabel = doseUnit
    ? t('hrt.form.doseWithUnit', { values: { unit: doseUnit } })
    : t('hrt.form.dose');
  // Show the derived mg live, so « 0.4 mL » reads « ≈ 4 mg » before saving.
  const doseVal = watch('dose');
  const mgPreview = Number.isFinite(doseVal) ? mgEquivalent(doseVal, selected) : null;
  const categories = HRT_CATEGORY_VALUES.filter((c) =>
    products.some((p) => p.category === c),
  );

  async function onValid(values: FormOut): Promise<void> {
    setServerError(null);
    const payload: HrtAdminLogPayload = { ...values, updatedAt: new Date().toISOString() };
    try {
      await onSubmit(payload, initial?.id);
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('hrt.form.saveFailed'));
    }
  }

  // Quick-add : create a product inline, then select it on the dose form.
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
      className={FORM_CARD}
      noValidate
    >
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[2fr_1fr_1fr]">
        <FieldRow label={t('hrt.form.product')} htmlFor="hrt-product" error={errors.product?.message}>
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <Select id="hrt-product" {...register('product')}>
                <option value="" disabled>
                  {products.length === 0
                    ? t('hrt.form.productNone')
                    : t('hrt.form.productPlaceholder')}
                </option>
                {categories.map((c) => (
                  <optgroup key={c} label={categoryLabel(t, c)}>
                    {products
                      .filter((p) => p.category === c)
                      .map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                          {p.medication ? ` · ${p.medication}` : ''}
                          {typeof p.concentration === 'number'
                            ? ` (${p.concentration} mg/mL)`
                            : ''}
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
              {t('hrt.form.newProduct')}
            </Button>
          </div>
        </FieldRow>

        <FieldRow label={doseLabel} htmlFor="hrt-dose" error={errors.dose?.message}>
          <Input
            id="hrt-dose"
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="0.4"
            // Hide the native number-spinner arrows (webkit + Firefox).
            className="[appearance:textfield] [&::-webkit-inner-spin-button]:[-webkit-appearance:none] [&::-webkit-outer-spin-button]:[-webkit-appearance:none] [&::-webkit-inner-spin-button]:m-0"
            {...(errors.dose ? { 'aria-invalid': true as const } : {})}
            {...register('dose', { valueAsNumber: true })}
          />
          {mgPreview != null ? (
            <p className="mt-1 text-[11px] text-muted">≈ {mgPreview} mg</p>
          ) : null}
        </FieldRow>

        <FieldRow label={t('hrt.form.date')} htmlFor="hrt-date" error={errors.date?.message}>
          <DateField
            id="hrt-date"
            value={watch('date') ?? ''}
            onChange={(iso) => setValue('date', iso, { shouldValidate: true })}
            {...(errors.date ? { ariaInvalid: true } : {})}
          />
        </FieldRow>
      </div>

      <FieldRow label={t('hrt.form.notes')} htmlFor="hrt-notes" error={errors.notes?.message}>
        <Textarea id="hrt-notes" minHeightPx={56} {...register('notes')} />
      </FieldRow>

      {serverError ? (
        <p role="alert" className="mb-3 text-[12px] text-danger">
          {serverError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="neutral" size="sm" onClick={onClose} disabled={isSubmitting}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {initial ? t('common.actions.save') : t('common.actions.add')}
        </Button>
      </div>
    </form>
  );
}
