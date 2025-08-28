// src/components/common/Button.jsx

export default function Button({
  type = "button",
  className = "",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`min-w-50 w-2/6 text-nodea-sand py-2.5 px-6 rounded hover:text-nodea-sand font-display font-semibold transition text-sm ${className}`}
    >
      {children}
    </button>
  );
}
