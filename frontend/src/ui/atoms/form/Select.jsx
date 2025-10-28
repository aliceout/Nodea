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
        className={`w-full px-3 py-2 border rounded-lg border-gray-200 text-sm transition-colors focus:border-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-slate-300/40 placeholder:text-sm disabled:bg-slate-100 disabled:text-gray-400 disabled:border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-600/40 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 ${inputClassName}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </select>
      {legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
    </div>
  );
}
