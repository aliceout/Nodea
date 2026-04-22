import type { ReactNode, TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  labelClassName?: string;
  legend?: ReactNode;
  /** Wrapper (div) classes — not forwarded to the textarea element. */
  className?: string;
  /** Classes applied directly to the textarea element. */
  inputClassName?: string;
}

export default function Textarea({
  label,
  labelClassName = '',
  className = '',
  inputClassName = '',
  rows = 3,
  required = false,
  legend,
  id,
  ...props
}: TextareaProps) {
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
      <textarea
        id={id}
        rows={rows}
        required={required}
        className={`mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-default)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus:border-[var(--accent-primary-strong)] hover:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary-glow)] placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:border-[var(--border-default)]/70 disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-muted)] ${inputClassName}`}
        {...props}
      />
      {legend ? <p className="mt-1 text-xs text-[var(--text-muted)]">{legend}</p> : null}
    </div>
  );
}
