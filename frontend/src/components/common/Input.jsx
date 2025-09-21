// src/components/common/Input.jsx

export default function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder = "",
  required = false,
  className = "",
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
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`w-full p-2 border rounded text-sm focus:outline-none placeholder:text-sm ${className} focus:ring-1 focus:ring-nodea-sage-dark focus:border-nodea-sage-dark`}
        {...props}
      />
      {legend && <p className="text-xs text-gray-500 mt-1">{legend}</p>}
    </div>
  );
}
