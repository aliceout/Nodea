// Atom canonical: @/ui/atoms/form/Input
// Implémentation rétablie (l’ancienne ligne de self re-export a été supprimée)

/**
 * Input générique
 * Props supportées :
 * - label, labelClassName
 * - type, value, onChange, placeholder
 * - disabled, required
 * - className (wrapper), inputClassName (élément input)
 * - legend (texte d'aide sous champ)
 * - ...props (attributs natifs)
 */
export default function Input({
  label,
  labelClassName = "",
  type = "text",
  value,
  onChange,
  placeholder = "",
  disabled = false,
  required = false,
  className = "",
  inputClassName = "",
  legend,
  ...props
}) {
  const inputId = props.id;
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-sm font-medium text-[var(--text-secondary)] ${labelClassName}`}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus:border-[var(--accent-primary-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary-glow)] placeholder:text-[var(--text-muted)] hover:border-[var(--accent-primary)] disabled:cursor-not-allowed disabled:border-[var(--border-default)]/70 disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-muted)] ${inputClassName}`}
        {...props}
      />
      {legend && <p className="mt-1 text-xs text-[var(--text-muted)]">{legend}</p>}
    </div>
  );
}
