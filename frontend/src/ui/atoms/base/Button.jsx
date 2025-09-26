// Atom canonical: @/ui/atoms/base/Button
// (Removed legacy self re-export to avoid duplicate default export)

export default function Button({
  type = "button",
  className = "",
  as = "button",
  children,
  ...props
}) {
  const commonProps = {
    className: `min-w-50 w-3/12 text-nodea-sand py-2 px-4 rounded hover:text-nodea-sand  text-center font-display font-semibold transition text-sm ${className}`,
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
