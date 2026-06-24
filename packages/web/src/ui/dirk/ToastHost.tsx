import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/20/solid';

import { useNodeaStore } from '@/core/store/nodea-store';
import type { ToastNotification } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

/**
 * Top-level toast host — the missing renderer for the `notifications`
 * store slice (issue #145). `pushToast` was writing toasts into the
 * store but nothing displayed them, so every toast was silently
 * dropped. Mounted once under the providers in `App`; portals to
 * `<body>` so it floats above every surface (modals included).
 *
 * Accessibility: info / success are polite (`role="status"`), warning /
 * error interrupt (`role="alert"`) — matching how assistive tech treats
 * each. Each toast auto-dismisses after `AUTO_DISMISS_MS` and carries a
 * manual close button. The container is `pointer-events-none` so its
 * empty gutter never eats clicks; each toast re-enables pointer events.
 */
const AUTO_DISMISS_MS = 5000;

const KIND_CLASS: Record<ToastNotification['kind'], string> = {
  info: 'border-hair text-ink',
  success: 'border-accent bg-accent/5 text-accent-deep',
  warning:
    'border-amber-500 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  error: 'border-danger bg-danger/5 text-danger',
};

export default function ToastHost() {
  const notifications = useNodeaStore((s) => s.notifications);
  const dismissToast = useNodeaStore((s) => s.dismissToast);

  if (notifications.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {notifications.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>,
    document.body,
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
}) {
  const { t } = useI18n();

  // Auto-dismiss. Deps are stable (the toast id + the store action, which
  // keeps a constant identity in Zustand), so the timer is armed once per
  // toast rather than reset on every parent render.
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const assertive = toast.kind === 'warning' || toast.kind === 'error';

  return (
    <div
      role={assertive ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto animate-fade-up flex items-start gap-2 rounded-[10px] border border-l-2 bg-bg px-3 py-2.5 text-[13px] leading-[1.45] shadow-[0_8px_24px_rgba(0,0,0,0.12)]',
        KIND_CLASS[toast.kind],
      )}
    >
      <span className="min-w-0 flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t('common.actions.close')}
        className="-mr-1 shrink-0 rounded-sm p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-current"
      >
        <XMarkIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
