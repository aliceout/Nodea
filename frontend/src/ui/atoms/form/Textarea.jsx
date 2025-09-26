// Deprecated: use @/ui/atoms/form/Textarea
export { default } from "./Textarea";
import React from "react";

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
  rows = 2,
  required = false,
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
      <textarea
        value={value}
        onChange={onChange}
        className={`w-full p-2 border border-nodea-slate-lighter hover:border-nodea-slate rounded min-h-9 resize-y align-top focus:ring-1 focus:ring-nodea-sage-dark focus:border-nodea-sage-dark text-sm placeholder:text-sm disabled:bg-nodea-slate-light disabled:text-gray-400 disabled:border-nodea-slate-light ${inputClassName}`}
        rows={rows}
        required={required}
        {...props}
      />
      {legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
    </div>
  );
}
