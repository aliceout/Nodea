// Atom canonical: @/ui/atoms/base/Button
// (Removed legacy self re-export to avoid duplicate default export)

import clsx from "clsx";

const variantStyles = {
  primary:
    "bg-nodea-sage-dark text-white hover:bg-nodea-sage-darker focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-nodea-sage-dark",
  primarySoft:
    "bg-nodea-sage text-white hover:bg-nodea-sage-dark focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-nodea-sage",
  info:
    "bg-nodea-sky-dark text-white hover:bg-nodea-sky-darker focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-nodea-sky-dark",
  danger:
    "bg-nodea-blush-dark text-white hover:bg-nodea-blush-darker focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-nodea-blush-dark",
  accent:
    "bg-[var(--accent-primary-strong)] text-white hover:bg-[var(--accent-primary)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-primary-strong)]",
  secondary:
    "border border-[var(--border-default)] bg-[var(--surface-default)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-primary)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2",
  ghostDanger:
    "bg-transparent text-[var(--accent-danger)] hover:text-[var(--accent-danger)]/80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-danger)]",
  link: "bg-transparent px-0 py-0 text-sm font-semibold text-[var(--accent-primary-strong)] underline underline-offset-2 hover:text-[var(--accent-primary)] focus-visible:ring-0",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-base",
};

export default function Button({
  type = "button",
  className = "",
  as = "button",
  children,
  unstyled = false,
  variant = "primary",
  size = "md",
  ...props
}) {
  const Component = as;

  const resolvedSize = sizeClasses[size] ?? sizeClasses.md;
  const resolvedVariant = variantStyles[variant] ?? variantStyles.primary;

  const baseClass = unstyled
    ? className
    : clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-150 ease-out focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
        resolvedSize,
        resolvedVariant,
        className
      );

  if (Component === "label") {
    return <label className={baseClass} {...props}>{children}</label>;
  }

  if (Component !== "button") {
    return (
      <Component className={baseClass} {...props}>
        {children}
      </Component>
    );
  }

  return (
    <button type={type} className={baseClass} {...props}>
      {children}
    </button>
  );
}
