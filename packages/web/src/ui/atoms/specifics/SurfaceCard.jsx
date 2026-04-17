import clsx from "clsx";
import Surface from "@/ui/atoms/layout/Surface.jsx";

export default function SurfaceCard({
  title,
  description,
  children,
  className = "",
  bodyClassName = "",
  as = "section",
  tone = "base",
  border = "default",
  padding = "md",
  radius = "lg",
  shadow = "sm",
  interactive = false,
  ...props
}) {
  return (
    <Surface
      as={as}
      tone={tone}
      border={border}
      padding={padding}
      radius={radius}
      shadow={shadow}
      interactive={interactive}
      className={className}
      {...props}
    >
      {(title || description) && (
        <header className="flex flex-col gap-1">
          {title ? (
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {title}
            </h3>
          ) : null}
          {description ? (
            <p className="text-sm text-[var(--text-muted)]">{description}</p>
          ) : null}
        </header>
      )}

      <div className={clsx(bodyClassName)}>{children}</div>
    </Surface>
  );
}
