// src/components/common/Input.jsx
import React, { forwardRef } from "react";

const Input = forwardRef(function Input(
  {
    label,
    labelClassName = "",
    type = "text",
    value,
    onChange,
    placeholder = "",
    required = false,
    className = "", // classes pour le CONTENEUR
    inputClassName = "", // classes pour l'<input> uniquement
    legend,
    ...props
  },
  ref
) {
  return (
    <div className={"flex flex-col " + className}>
      {label && (
        <label
          className={
            "block mb-1 font-semibold text-nodea-sage-dark " + labelClassName
          }
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
  className={`w-full p-2 border rounded border-nodea-slate-light hover:border-nodea-slate focus:ring-1 focus:ring-nodea-sage-dark focus:border-nodea-sage-dark text-sm placeholder:text-sm disabled:bg-nodea-slate-light disabled:text-gray-400 disabled:border-nodea-slate-light ${inputClassName}`}
        {...props}
      />
      {legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
    </div>
  );
});

export default Input;
