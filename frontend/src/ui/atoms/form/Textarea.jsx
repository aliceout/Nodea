
/**
 * Textarea
 * Props :
 *   - label: string (optionnel)
 *   - labelClassName: string (optionnel, classes pour le label)
 *   - value: string
 *   - onChange: function
 *   - className: string (optionnel, classes pour le conteneur)
 *   - inputClassName: string (optionnel, classes pour le textarea)
 *   - rows: number (optionnel)
 *   - required: bool (optionnel)
 *   - legend: string (optionnel)
 *   - ...props
 */
export default function Textarea({
  label,
  labelClassName = "",
  value,
  onChange,
  className = "",
  inputClassName = "",
  rows = 3,
  required = false,
  legend,
  ...props
}) {
  const textareaId = props.id;
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label
          htmlFor={textareaId}
          className={`block text-sm font-medium text-slate-700 ${labelClassName}`}
        >
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={onChange}
        rows={rows}
        required={required}
        className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/40 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 ${inputClassName}`}
        {...props}
      />
      {legend && <p className="mt-1 text-xs text-slate-500">{legend}</p>}
    </div>
  );
}
