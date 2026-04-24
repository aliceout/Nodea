import type { InputHTMLAttributes, ReactNode, Ref } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  labelClassName?: string;
  type?: string;
  legend?: ReactNode;
  /** Wrapper (div) classes — not forwarded to the input element. */
  className?: string;
  /** Classes applied directly to the input element. */
  inputClassName?: string;
  /**
   * Ref to the underlying `<input>`. React 19 allows this as a regular
   * prop — no `forwardRef` wrapper needed.
   */
  ref?: Ref<HTMLInputElement>;
}

export default function Input({
  label,
  labelClassName = '',
  type = 'text',
  placeholder = '',
  disabled = false,
  required = false,
  className = '',
  inputClassName = '',
  legend,
  id,
  ref,
  ...props
}: InputProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      {label ? (
        <label
          htmlFor={id}
          className={`block text-sm font-medium text-[var(--text-secondary)] ${labelClassName}`}
        >
          {label}
        </label>
      ) : null}
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        ref={ref}
        className={`mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus:border-[var(--accent-primary-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary-glow)] placeholder:text-[var(--text-muted)] hover:border-[var(--accent-primary)] disabled:cursor-not-allowed disabled:border-[var(--border-default)]/70 disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-muted)] ${inputClassName}`}
        {...props}
      />
      {legend ? <p className="mt-1 text-xs text-[var(--text-muted)]">{legend}</p> : null}
    </div>
  );
}
