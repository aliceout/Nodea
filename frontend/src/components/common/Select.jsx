import React from "react";

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
            "block mb-1 font-semibold text-nodea-sage-dark text-sm " + labelClassName
          }
        >
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        className={`w-full p-2 border rounded border-nodea-slate-light hover:border-nodea-slate focus:ring-1 focus:ring-nodea-sage-dark focus:border-nodea-sage-dark text-sm placeholder:text-sm disabled:bg-nodea-slate-light disabled:text-gray-400 disabled:border-nodea-slate-light ${inputClassName}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </select>
      {legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
    </div>
  );
}
