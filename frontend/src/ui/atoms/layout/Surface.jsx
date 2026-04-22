import clsx from "clsx";

export default function Surface({
  as: Component = "section",
  tone = "base", // base | muted | subtle | inverse
  border = "default", // default | strong | minimal
  padding = "md", // none | sm | md | lg
  radius = "lg", // sm | md | lg
  shadow = "sm", // none | sm | md
  interactive = false,
  className = "",
  children,
  ...props
}) {
  const toneClasses = {
    base: "bg-[var(--surface-default)] text-[var(--text-primary)]",
    muted: "bg-[var(--surface-muted)] text-[var(--text-primary)]",
    subtle: "bg-[var(--surface-subtle)] text-[var(--text-primary)]",
    inverse: "bg-[var(--surface-inverse)] text-[var(--text-inverse)]",
  };

  const paddingClasses = {
    none: "gap-0 p-0",
    sm: "gap-[var(--surface-gap-sm)] p-[var(--surface-padding-sm)]",
    md: "gap-[var(--surface-gap-md)] p-[var(--surface-padding-md)]",
    lg: "gap-[var(--surface-gap-lg)] p-[var(--surface-padding-lg)]",
  };

  const radiusClasses = {
    sm: "rounded-[var(--radius-sm)]",
    md: "rounded-[var(--radius-md)]",
    lg: "rounded-[var(--radius-lg)]",
  };

  const shadowBase = {
    none: "shadow-none",
    sm: "shadow-[var(--shadow-xs)]",
    md: "shadow-[var(--shadow-md)]",
  };

  const hoverShadow = {
    none: "hover:shadow-none",
    sm: "hover:shadow-[var(--shadow-sm)]",
    md: "hover:shadow-[var(--shadow-md)]",
  };

  const toneClassName = toneClasses[tone] ?? toneClasses.base;
  const paddingClassName = paddingClasses[padding] ?? paddingClasses.md;
  const radiusClassName = radiusClasses[radius] ?? radiusClasses.lg;

  const isMinimalBorder = border === "minimal";

  const borderClassName =
    border === "strong"
      ? "border border-[var(--border-strong)]"
      : border === "minimal"
      ? "border border-transparent"
      : tone === "inverse"
      ? "border border-[var(--border-inverse)]"
      : "border border-[var(--border-default)]";

  const shadowClassName = isMinimalBorder
    ? "shadow-none"
    : shadowBase[shadow] ?? shadowBase.sm;

  const interactiveShadowClass =
    interactive && !isMinimalBorder
      ? hoverShadow[shadow] ?? hoverShadow.sm
      : interactive
      ? "hover:shadow-none"
      : "";

  return (
    <Component
      className={clsx(
        "surface flex flex-col transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out",
        toneClassName,
        borderClassName,
        paddingClassName,
        radiusClassName,
        shadowClassName,
        interactiveShadowClass,
        interactive ? "cursor-pointer hover:-translate-y-[1px]" : "",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
