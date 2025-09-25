import clsx from "clsx";

export default function SubNavDesktop({ title, tabs = [], onTabSelect }) {
  if (!tabs.length) return null;

  return (
    // caché en mobile ; visible md+ ; prend la place restante
    <nav
      className="hidden md:flex items-center gap-1 flex-1 md:overflow-x-auto md:whitespace-nowrap lg:overflow-visible "
      aria-label={`${title ?? "Sections"} tabs`}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onTabSelect?.(t.id)}
          className={clsx(
            "px-3 py-1.5 text-sm rounded-md transition",
            t.active
              ? "bg-none text-nodea-sage-darker bg-nodea-sand hover:bg-nodea-sage-lighter"
              : "text-nodea-sage-dark hover:bg-nodea-sage-lighter/50"
          )}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
