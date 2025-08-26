import classNames from "classnames";

export default function Link({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        active
          ? "bg-nodea-sage-lighter text-nodea-slate-light hover:bg-nodea-sage-light hover:text-nodea-sage-darker"
          : "text-nodea-sage-dark hover:bg-nodea-sage-light hover:text-nodea-sage-darker",
        "group flex w-full gap-x-3 rounded-md p-2 text-sm"
      )}
    >
      {Icon && (
        <Icon
          className={classNames(
            active
              ? "text-nodea-slate-light group-hover:text-nodea-sage-darker"
              : "text-nodea-sage-dark group-hover:text-nodea-sage-darker",
            "h-6 w-6 shrink-0"
          )}
        />
      )}
      {label}
    </button>
  );
}
