import type { ReactNode, SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  labelClassName?: string;
  legend?: ReactNode;
  /** Wrapper (div) classes — not forwarded to the native element. */
  className?: string;
  /** Classes applied directly to the native select element. */
  inputClassName?: string;
  children?: ReactNode;
}

export default function Select({
  label,
  labelClassName = '',
  className = '',
  inputClassName = '',
  disabled = false,
  legend,
  children,
  ...props
}: SelectProps) {
  return (
    <div className={'flex flex-col ' + className}>
      {label ? (
        <label
          className={
            'block mb-1 font-semibold text-nodea-sage-dark text-sm ' + labelClassName
          }
        >
          {label}
        </label>
      ) : null}
      <select
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg border-gray-200 text-sm transition-colors focus:border-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-slate-300/40 placeholder:text-sm disabled:bg-slate-100 disabled:text-gray-400 disabled:border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-600/40 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 ${inputClassName}`}
        {...props}
      >
        {children}
      </select>
      {legend ? <p className="text-xs text-gray-500 mt-1">{legend}</p> : null}
    </div>
  );
}
