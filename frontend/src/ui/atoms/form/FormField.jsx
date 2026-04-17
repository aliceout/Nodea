import clsx from "clsx";

export default function FormField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className = "",
  children,
}) {
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="text-[0.9rem] font-semibold text-[var(--text-secondary)]"
        >
          {label}
          {required ? <span className="ml-1 text-[var(--accent-danger)]">*</span> : null}
        </label>
      ) : null}

      {children}

      {hint && !error ? (
        <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      ) : null}

      {error ? (
        <p className="text-xs font-medium text-[var(--accent-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
