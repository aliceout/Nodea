import clsx from "clsx";

const toneStyles = {
  neutral:
    "border border-transparent bg-[rgba(148,163,184,0.14)] text-[#475569]",
  info: "border border-transparent bg-[rgba(96,165,250,0.12)] text-[#1d4ed8]",
  success: "border border-transparent bg-[rgba(74,222,128,0.10)] text-[#047857]",
  warning:
    "border border-transparent bg-[rgba(250,204,21,0.14)] text-[#92400e]",
  danger:
    "border border-transparent bg-[rgba(248,113,113,0.12)] text-[#b91c1c]",
};

export default function Badge({
  tone = "neutral", // neutral | info | success | warning | danger
  icon = null,
  children,
  className = "",
  ...props
}) {
  const toneClassName =
    toneStyles[tone] ?? toneStyles.neutral;

  return (
    <span
      className={clsx(
        "badge inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-none transition-colors",
        toneClassName,
        className
      )}
      {...props}
    >
      {icon ? (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
