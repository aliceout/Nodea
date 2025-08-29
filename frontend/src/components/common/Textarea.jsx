import React from "react";

export default function Textarea({
  value,
  onChange,
  className = "",
  rows = 2,
  required = false,
  ...props
}) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      className={`w-full p-3 border rounded min-h-18 resize-none align-top focus:outline-none focus:ring-0 ${className}`}
      rows={rows}
      required={required}
      {...props}
    />
  );
}
