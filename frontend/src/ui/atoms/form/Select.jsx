/**
 * Composant Select réutilisable
 * Props :
 * - label (optionnel)
 * - value
 * - onChange
 * - children (option tags)
 * - className (optionnel)
 * - disabled (optionnel)
 * - ...props (autres props natifs)
 */
export default function Select({
  label,
  labelClassName = "",
  value,
  onChange,
  children,
  className = "",
  inputClassName = "",
  disabled = false,
  legend,
  ...props
}) {
  return (
    <div className={"flex flex-col " + className}>
      {label && (
        <label
          className={
            "block mb-1 font-semibold text-nodea-sage-dark text-sm " +
            labelClassName
          }
        >
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        className={`w-full px-3 py-2 border rounded-lg border-gray-200 text-sm transition-colors focus:border-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-slate-300/40 placeholder:text-sm disabled:bg-slate-100 disabled:text-gray-400 disabled:border-gray-200 ${inputClassName}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </select>
      {legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
    </div>
  );
}
