import DatePicker from 'react-datepicker';
import type { ReactNode } from 'react';
import 'react-datepicker/dist/react-datepicker.css';

interface DateMonthPickerProps {
  label?: ReactNode;
  /** "YYYY-MM" or "". */
  value: string;
  /**
   * Called with a synthetic `{ target: { value } }` where `value` is
   * "YYYY-MM" or "" — mirrors native input events so callers can use a
   * single onChange signature across the form atoms.
   */
  onChange: (event: { target: { value: string } }) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  legend?: ReactNode;
}

/**
 * Visual month + year picker. Thin wrapper over `react-datepicker` that
 * encodes/decodes the chosen Date to the "YYYY-MM" wire format used
 * across Goals / Passage forms.
 */
export default function DateMonthPicker({
  label,
  value,
  onChange,
  disabled = false,
  className = '',
  inputClassName = '',
  legend,
}: DateMonthPickerProps) {
  const selectedDate = value ? new Date(value + '-01') : null;

  return (
    <div className={`flex flex-col ${className}`}>
      {label ? (
        <label className="block mb-1 font-semibold text-nodea-sage-dark text-sm">
          {label}
        </label>
      ) : null}
      <DatePicker
        selected={selectedDate}
        onChange={(date) =>
          onChange({
            target: { value: date ? date.toISOString().slice(0, 7) : '' },
          })
        }
        dateFormat="yyyy-MM"
        showMonthYearPicker
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg border-gray-200 text-sm transition-colors focus:border-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-slate-300/40 placeholder:text-sm disabled:bg-slate-100 disabled:text-gray-400 disabled:border-gray-200 ${inputClassName}`.trim()}
        popperClassName="bg-white border border-gray-200 rounded-lg shadow-lg text-slate-700"
      />
      {legend ? <p className="text-xs text-gray-500 mt-1">{legend}</p> : null}
    </div>
  );
}
