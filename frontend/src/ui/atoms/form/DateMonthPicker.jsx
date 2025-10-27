// Atom canonical: @/ui/atoms/form/DateMonthPicker
// (Removed legacy self re-export)
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

/**
 * DateMonthPicker
 * Sélecteur visuel mois + année, réutilisable.
 * Props :
 * - label (optionnel)
 * - value (format "YYYY-MM" ou "")
 * - onChange (callback, reçoit "YYYY-MM" ou "")
 * - disabled (optionnel)
 * - className (optionnel, pour le conteneur)
 * - inputClassName (optionnel, pour l'input)
 */
export default function DateMonthPicker({
  label,
  value,
  onChange,
  disabled = false,
  className = "",
  inputClassName = "",
  legend,
}) {
  // Convertit la valeur "YYYY-MM" en Date JS
  const selectedDate = value ? new Date(value + "-01") : null;

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="block mb-1 font-semibold text-nodea-sage-dark text-sm">
          {label}
        </label>
      )}
      <DatePicker
        selected={selectedDate}
        onChange={(date) =>
          onChange({
            target: {
              value: date ? date.toISOString().slice(0, 7) : "",
            },
          })
        }
        dateFormat="yyyy-MM"
        showMonthYearPicker
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg border-gray-200 text-sm transition-colors focus:border-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-slate-300/40 placeholder:text-sm disabled:bg-slate-100 disabled:text-gray-400 disabled:border-gray-200 ${inputClassName}`.trim()}
        popperClassName="bg-white border border-gray-200 rounded-lg shadow-lg text-slate-700"
      />
      {legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
    </div>
  );
}
