import clsx from "clsx";
import Surface from "@/ui/atoms/layout/Surface.jsx";

export default function TableShell({
  title = null,
  description = null,
  actions = null,
  className = "",
  children,
  tone = "base",
  ...props
}) {
  return (
    <Surface
      padding="none"
      border="minimal"
      className={clsx("overflow-hidden", className)}
      tone={tone}
      {...props}
    >
      {(title || description || actions) && (
        <div className="flex flex-col gap-2 border-b border-[var(--border-default)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            {title ? (
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="text-sm text-[var(--text-muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      )}

      <div className="table-shell">
        {children}
      </div>
    </Surface>
  );
}
