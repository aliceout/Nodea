import React from "react";

export default function Textarea({
  label,
  value,
  onChange,
  className = "",
  rows = 2,
  required = false,
  legend,
  ...props
}) {
  return (
    <div className={"flex flex-col " + className}>
      {label && (
        <label className="block mb-1 font-semibold text-nodea-sage-dark">
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={onChange}
        className={`w-full p-3 border border-gray-400 hover:border-gray-500 rounded min-h-18 resize-none align-top focus:outline-none focus:ring-0 text-sm placeholder:text-sm ${className}`}
        rows={rows}
        required={required}
        {...props}
      />{" "}
      {legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
    </div>
  );
}
