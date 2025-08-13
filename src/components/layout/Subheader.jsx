import clsx from "clsx";

export default function Subheader({
  title, // ex: "Mood"
  tabs = [], // [{ id, label, active }]
  onTabSelect, // (id) => void
  cta, // { label, onClick, disabled? }
  className,
}) {
  return (
    <div
      className={clsx(
        "sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200",
        className
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
        {" "}
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1" aria-label={`${title} tabs`}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabSelect?.(t.id)}
                className={clsx(
                  "px-3 py-1.5 text-sm rounded-md transition",
                  t.active
                    ? "bg-none text-nodea-slate-dark font-semibold"
                    : "text-slate-600 hover:bg-nodea-sand hover:bg-nodea-nodea-slate"
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        {cta && (
          <button
            type="button"
            onClick={cta.onClick}
            disabled={cta.disabled}
            className={clsx(
              "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md ",
              cta.disabled
                ? "bg-white border-1 text-slate-400 cursor-not-allowed"
                : "bg-white border-1 border-nodea-sage text-nodea-sage-dark hover:bg-nodea-sage hover:text-white transition-colors"
            )}
          >
            {cta.label}
          </button>
        )}
      </div>
    </div>
  );
}
