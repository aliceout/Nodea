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
  value,
  onChange,
  children,
  className = "",
  disabled = false,
  legend,
  ...props
}) {
  return (
    <div className={"flex flex-col" + className}>
      {label && (
        <label className="block mb-1 font-semibold text-nodea-sage-dark">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        className="border rounded px-3 py-2 text-sm"
        disabled={disabled}
        {...props}
      >
        {children}
      </select>{" "}
      {legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
    </div>
  );
}
