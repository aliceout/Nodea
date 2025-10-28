import clsx from "clsx";

export default function SectionHeader({
  title,
  description,
  actions = null,
  className = "",
  align = "start", // start | center
  spacing = "default", // default | tight
}) {
  const containerClass = clsx(
    "section-header",
    actions ? "section-header--with-actions" : "",
    align === "center" ? "text-center sm:text-left" : "",
    spacing === "tight" ? "gap-1.5" : "",
    className
  );

  return (
    <div className={containerClass}>
      <div className="flex flex-col gap-2">
        {title ? <h2 className="section-header__title">{title}</h2> : null}
        {description ? (
          <p className="section-header__description">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
