// src/components/common/Input.jsx
import React, { forwardRef } from "react";

const Input = forwardRef(function Input(
  {
    label,
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
        <label className="block mb-1 font-semibold text-nodea-sage-dark">
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
        className={`w-full p-2 border rounded text-sm focus:outline-none placeholder:text-sm ${inputClassName} focus:ring-1 focus:ring-nodea-sage-dark focus:border-nodea-sage-dark`}
        {...props}
      />
      {legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
    </div>
  );
});

export default Input;
