// src/components/layout/Sidebar/Link.jsx
import classNames from "classnames";

export default function Link({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        active
          ? "bg-nodea-sand text-nodea-slate-light hover:bg-nodea-sage-light "
          : "text-nodea-sage-dark hover:bg-nodea-sage-light hover:text-nodea-slate",
        "group flex w-full gap-x-3 rounded-md p-2 text-sm font-semibold"
      )}
    >
      {Icon && (
        <Icon
          className={classNames(
            active
              ? "text-nodea-slate-light"
              : "text-nodea-sage-dark group-hover:text-nodea-slate",
            "h-6 w-6 shrink-0"
          )}
        />
      )}
      {label}
    </button>
  );
}
