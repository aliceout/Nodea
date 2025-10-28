import clsx from "clsx";

const toneClassMap = {
  neutral: "badge",
  info: "badge",
  success: "badge",
  warning: "badge",
  danger: "badge",
};

export default function Badge({
  tone = "neutral", // neutral | info | success | warning | danger
  icon = null,
  children,
  className = "",
  ...props
}) {
  return (
    <span
      className={clsx(toneClassMap[tone] || "badge", className)}
      data-tone={tone}
      {...props}
    >
      {icon ? <span className="inline-flex h-3.5 w-3.5 items-center justify-center">{icon}</span> : null}
      {children}
    </span>
  );
}
