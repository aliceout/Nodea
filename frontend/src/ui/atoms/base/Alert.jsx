export default function Alert({ type = "info", children, className = "" }) {
  const base = "rounded p-3 mb-2 font-sans";
  let color =
    type === "error"
      ? "bg-nodea-blush text-nodea-slate"
      : type === "success"
      ? "bg-nodea-sage text-nodea-slate"
      : "bg-nodea-lavender text-nodea-slate";
  return <div className={`${base} ${color} ${className}`}>{children}</div>;
}
