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
  const dataAttrs = {};
  if (tone !== "base") dataAttrs["data-tone"] = tone;
  if (border !== "default") dataAttrs["data-border"] = border;
  if (padding !== "md") dataAttrs["data-padding"] = padding;
  if (radius !== "lg") dataAttrs["data-radius"] = radius;
  if (shadow !== "sm") dataAttrs["data-shadow"] = shadow;
  if (interactive) dataAttrs["data-interactive"] = "true";

  return (
    <Component
      className={clsx("surface", className)}
      {...dataAttrs}
      {...props}
    >
      {children}
    </Component>
  );
}
