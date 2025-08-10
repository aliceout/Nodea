// src/components/layout/Sidebar/Link.jsx
import classNames from "classnames";

export default function Link({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        active
          ? "bg-gray-50 text-nodea-sage-dark"
          : "text-gray-700 hover:bg-gray-50 hover:text-nodea-sage-dark",
        "group flex w-full gap-x-3 rounded-md p-2 text-sm font-semibold"
      )}
    >
      {Icon && (
        <Icon
          className={classNames(
            active
              ? "text-nodea-sage-dark"
              : "text-gray-400 group-hover:text-nodea-sage-dark",
            "h-6 w-6 shrink-0"
          )}
        />
      )}
      {label}
    </button>
  );
}
