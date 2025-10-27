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
          className={`block text-sm font-medium text-slate-700 ${labelClassName}`}
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
        className={`mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors focus:border-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-slate-300/40 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-slate-100 ${inputClassName}`}
        {...props}
      />
      {legend && <p className="mt-1 text-xs text-slate-500">{legend}</p>}
    </div>
  );
}
