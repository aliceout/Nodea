import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose?: (() => void) | null;
  children?: ReactNode;
  className?: string;
  backdropClass?: string;
  disableClose?: boolean;
}

/**
 * Blocking dialog with focus trap + Escape-to-close (unless
 * `disableClose`). The outer backdrop is purely visual — clicks on it
 * do NOT close the modal; owners opt into dismissal via `onClose`.
 */
export default function Modal({
  open,
  onClose,
  children,
  className = '',
  backdropClass = '',
  disableClose = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (!disableClose && event.key === 'Escape') {
        onClose?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, disableClose, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div
        className={`fixed inset-0 ${backdropClass || 'bg-black/40 backdrop-blur-xs'} z-0`}
      />
      <div
        className={`relative my-8 max-h-[calc(100vh-4rem)] overflow-y-auto rounded-lg bg-white p-8 text-center shadow-lg ${className || 'w-full max-w-md'}`}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={dialogRef}
      >
        {children}
      </div>
    </div>
  );
}
