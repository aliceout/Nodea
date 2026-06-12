/**
 * Confirmation / alert provider + dialog (issue #143).
 *
 * Holds one shared dialog and hands every descendant `confirm()` +
 * `alert()` via context (see `confirm-context.tsx`). Mounted once near
 * the app root so any view can `useConfirm()` / `useAlert()`.
 *
 * Built on the shared `Modal` (Headless UI `Dialog` → focus trap,
 * scroll lock, Esc-to-dismiss, aria-modal) ; the title/description use
 * Headless `DialogTitle`/`DialogDescription` so `aria-labelledby` /
 * `aria-describedby` wire up automatically. Cancel is first in the DOM
 * so it takes initial focus — the safe default for destructive prompts.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { DialogTitle, DialogDescription } from '@headlessui/react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { Modal } from '@/ui/atoms/layout/Modal';
import Button from '@/ui/atoms/dirk/Button';

import {
  ConfirmContext,
  type AlertOptions,
  type ConfirmApi,
  type ConfirmOptions,
} from './confirm-context';

interface Pending {
  mode: 'confirm' | 'alert';
  options: ConfirmOptions | AlertOptions;
  /** Internal resolver. Confirm passes the boolean ; alert ignores it. */
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  // Retain the last pending so the dialog keeps its text + mode during
  // the close fade-out — `pending` is cleared synchronously on settle.
  const last = useRef<Pending | null>(null);
  if (pending) last.current = pending;

  const confirm = useCallback<ConfirmApi['confirm']>(
    (options) =>
      new Promise<boolean>((resolve) =>
        setPending({ mode: 'confirm', options, resolve }),
      ),
    [],
  );

  const alert = useCallback<ConfirmApi['alert']>(
    (options) =>
      new Promise<void>((resolve) =>
        setPending({ mode: 'alert', options, resolve: () => resolve() }),
      ),
    [],
  );

  const api = useRef<ConfirmApi>({ confirm, alert });

  const settle = useCallback((result: boolean) => {
    setPending((cur) => {
      cur?.resolve(result);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={api.current}>
      {children}
      <ConfirmDialog
        open={pending !== null}
        pending={last.current}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  pending: Pending | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ open, pending, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useI18n();
  const isAlert = pending?.mode === 'alert';
  const options = pending?.options ?? null;
  const tone = !isAlert && (options as ConfirmOptions | null)?.tone === 'danger';

  const confirmLabel = isAlert
    ? (options as AlertOptions | null)?.okLabel ?? t('common.actions.ok')
    : (options as ConfirmOptions | null)?.confirmLabel ?? t('common.actions.confirm');

  return (
    <Modal open={open} onClose={onCancel} size="md">
      <div className="p-6">
        {options?.title ? (
          <DialogTitle className="text-[16px] font-semibold tracking-[-0.005em] text-ink">
            {options.title}
          </DialogTitle>
        ) : null}
        <DialogDescription className="mt-2 whitespace-pre-line text-[14px] leading-[1.55] text-ink-soft">
          {options?.message}
        </DialogDescription>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {/* Cancel only for a confirm ; first in the DOM so it takes
              initial focus (safe default for destructive prompts). */}
          {!isAlert ? (
            <Button variant="neutral" size="sm" onClick={onCancel}>
              {(options as ConfirmOptions | null)?.cancelLabel ??
                t('common.actions.cancel')}
            </Button>
          ) : null}
          <Button
            variant={tone ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
