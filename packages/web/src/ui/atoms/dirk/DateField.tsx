/**
 * K · Sauge date field — a French-formatted date picker (jj/mm/aaaa).
 *
 * Why not a native `<input type="date">` : its display format follows the
 * BROWSER's locale, not the app's — so a French Nodea on an English browser
 * shows MM/DD/YYYY, which the page `lang` can't override. react-datepicker
 * with the date-fns `fr` locale gives a stable French format everywhere.
 *
 * Wraps the dirk `Input` as the trigger (so it lines up with every other
 * field, incl. the `borderless` variant), and speaks ISO `YYYY-MM-DD` on
 * the wire — the value model the forms + encrypted payloads already use.
 * Dates are parsed at LOCAL midnight (no timezone shift that could bump the
 * day). The fr locale is registered once at module load.
 */
import { useId } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { fr } from 'date-fns/locale/fr';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Input from './Input';

registerLocale('fr', fr);

interface DateFieldProps {
  id?: string;
  /** ISO `YYYY-MM-DD` ; `''` = empty. */
  value: string;
  onChange: (iso: string) => void;
  /** Inclusive bounds, ISO `YYYY-MM-DD`. */
  min?: string;
  max?: string;
  disabled?: boolean;
  /** Chrome-less variant (matches `Input.borderless`). */
  borderless?: boolean;
  /** Shrink to content instead of filling the row — for inline date rows
   *  (the Du → Au range, the Mood header) where several sit side by side. */
  inline?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
}

/** Parse an ISO `YYYY-MM-DD` to a LOCAL-midnight Date (no TZ shift). */
function isoToDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Format a Date back to ISO `YYYY-MM-DD` (local). */
function dateToIso(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export default function DateField({
  id,
  value,
  onChange,
  min,
  max,
  disabled = false,
  borderless = false,
  inline = false,
  className,
  ariaLabel,
  ariaInvalid = false,
}: DateFieldProps) {
  const { t } = useI18n();
  const reactId = useId();
  const minD = min ? isoToDate(min) : null;
  const maxD = max ? isoToDate(max) : null;

  return (
    <DatePicker
      id={id ?? reactId}
      selected={isoToDate(value)}
      onChange={(d) => onChange(d ? dateToIso(d) : '')}
      dateFormat="dd/MM/yyyy"
      locale="fr"
      placeholderText={t('layout.dateField.placeholder')}
      disabled={disabled}
      {...(inline ? { wrapperClassName: 'dp-inline' } : {})}
      {...(minD ? { minDate: minD } : {})}
      {...(maxD ? { maxDate: maxD } : {})}
      customInput={
        <Input
          borderless={borderless}
          {...(className ? { className } : {})}
          {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
          {...(ariaInvalid ? { 'aria-invalid': true as const } : {})}
        />
      }
    />
  );
}
