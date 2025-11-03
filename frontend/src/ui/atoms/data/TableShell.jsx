import { Children, cloneElement, isValidElement } from "react";
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

      <div className="overflow-x-auto">
        <div className="w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-default)]">
          {Children.map(children, (child) => {
            if (!isValidElement(child)) {
              return child;
            }

            if (typeof child.type === "string" && child.type === "table") {
              return cloneElement(child, {
                className: clsx(
                  "w-full border-collapse text-left text-sm text-[var(--text-secondary)]",
                  child.props.className
                ),
              });
            }

            return child;
          })}
        </div>
      </div>
    </Surface>
  );
}
