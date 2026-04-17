
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
          className={`block text-sm font-medium text-[var(--text-secondary)] ${labelClassName}`}
        >
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={onChange}
        rows={rows}
        required={required}
        className={`mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus:border-[var(--accent-primary-strong)] hover:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary-glow)] placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:border-[var(--border-default)]/70 disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-muted)] ${inputClassName}`}
        {...props}
      />
      {legend && <p className="mt-1 text-xs text-[var(--text-muted)]">{legend}</p>}
    </div>
  );
}
