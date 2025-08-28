// src/components/common/Button.jsx

export default function Button({
  type = "button",
  className = "",
  as = "button",
  children,
  ...props
}) {
  const commonProps = {
    className: `min-w-50 w-2/6 text-nodea-sand py-2.5 px-6 rounded hover:text-nodea-sand  text-center font-display font-semibold transition text-sm ${className}`,
    ...props,
  };
  if (as === "label") {
    return <label {...commonProps}>{children}</label>;
  }
  return (
    <button type={type} {...commonProps}>
      {children}
    </button>
  );
}
