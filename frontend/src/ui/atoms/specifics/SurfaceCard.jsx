import clsx from "clsx";

export default function SurfaceCard({
  title,
  children,
  className = "",
  bodyClassName = "",
  as: Component = "section",
  ...props
}) {
  return (
    <Component
      className={clsx(
        "flex flex-col rounded-xl border border-gray-200 bg-white/50 p-6 transition-colors hover:border-gray-300 hover:bg-white/60",
        className
      )}
      {...props}
    >
      {title ? (
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      ) : null}

      <div className={clsx(title ? "mt-3" : "", bodyClassName)}>{children}</div>
    </Component>
  );
}

