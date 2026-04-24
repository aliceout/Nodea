interface FormErrorProps {
  message?: string | null;
  type?: 'error' | 'success';
  className?: string;
}

/**
 * Form-level feedback (error or success). Renders nothing when `message`
 * is falsy so callers can pass `{error && <FormError ... />}` patterns.
 */
export default function FormError({
  message,
  type = 'error',
  className = '',
}: FormErrorProps) {
  if (!message) return null;

  const color = type === 'success' ? 'text-nodea-sage' : 'text-nodea-blush-dark';

  return <div className={`mt-2 text-center ${color} ${className}`}>{message}</div>;
}
