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
    <div className={clsx("form-control", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="form-control__label"
        >
          {label}
          {required ? <span className="ml-1 text-[var(--accent-danger)]">*</span> : null}
        </label>
      ) : null}

      {children}

      {hint && !error ? (
        <p className="form-control__hint">{hint}</p>
      ) : null}

      {error ? <p className="form-control__error">{error}</p> : null}
    </div>
  );
}
