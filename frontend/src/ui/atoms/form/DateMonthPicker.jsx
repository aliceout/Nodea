import React from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function DateMonthPicker({
  label,
  value,
  onChange,
  disabled = false,
  className = "",
  inputClassName = "",
  legend,
}) {
  const selectedDate = value ? new Date(value + "-01") : null;
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="block mb-1 font-semibold text-nodea-sage-dark text-sm">
          {label}
        </label>
      )}
      <DatePicker
        selected={selectedDate}
        onChange={(date) =>
          onChange({ target: { value: date ? date.toISOString().slice(0, 7) : "" } })
        }
        dateFormat="yyyy-MM"
        showMonthYearPicker
        disabled={disabled}
        className="w-full p-2 border rounded border-nodea-slate-light hover:border-nodea-slate focus:ring-1 focus:ring-nodea-sage-dark focus:border-nodea-sage-dark text-sm placeholder:text-sm disabled:bg-nodea-slate-light disabled:text-gray-400 disabled:border-nodea-slate-light"
        popperClassName="bg-nodea-slate-light border border-nodea-sage-dark rounded shadow-lg text-nodea-sage-dark"
      />
      {legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
    </div>
  );
}
