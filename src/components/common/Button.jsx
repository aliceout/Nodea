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
      className={
        `w-full bg-nodea-sage text-nodea-sand py-3 rounded hover:bg-nodea-sage-dark hover:text-nodea-sand font-display font-semibold transition ` +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}
