/**
 * Promise-based confirmation / alert context (issue #143).
 *
 * Replaces the native `window.confirm` and `alert` — blocking,
 * unstyled, un-i18n'd, leaking browser chrome — with one in-app dialog.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ message: t('…'), tone: 'danger' })) { … }
 *
 *   const alert = useAlert();
 *   await alert({ message: t('…') });   // OK-only acknowledgement
 *
 * The provider + dialog live in `ConfirmProvider.tsx` ; this file holds
 * only the context + hooks + types, so a component file never mixes a
 * component export with a hook (keeps `react-refresh` happy).
 *
 * Why a modal and not a toast for `alert` : the app has a toast slice
 * but no host renders it, so toasts are currently invisible (bug
 * tracked in #145). The alerts being replaced are blocking error
 * acknowledgements, for which a modal is the faithful, visible
 * replacement.
 */
import { createContext, useContext } from 'react';

export interface ConfirmOptions {
  /** Optional heading above the message. */
  title?: string;
  /** The question. Pass an already-translated string (the dialog does
   *  not call `t` on it). Newlines render as line breaks. */
  message: string;
  /** Confirm button label. Defaults to `common.actions.confirm`. */
  confirmLabel?: string;
  /** Cancel button label. Defaults to `common.actions.cancel`. */
  cancelLabel?: string;
  /** `danger` paints the confirm button red — use for destructive,
   *  irreversible actions (delete, wipe). Defaults to `default`. */
  tone?: 'default' | 'danger';
}

export interface AlertOptions {
  /** Optional heading above the message. */
  title?: string;
  /** The message to acknowledge. Already-translated. */
  message: string;
  /** Acknowledge button label. Defaults to `common.actions.ok`. */
  okLabel?: string;
}

export interface ConfirmApi {
  /** Resolves `true` on confirm, `false` on cancel / Esc / backdrop. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** OK-only acknowledgement. Resolves once dismissed. */
  alert: (options: AlertOptions) => Promise<void>;
}

export const ConfirmContext = createContext<ConfirmApi | null>(null);

/** Async confirmation. Drop-in for `window.confirm` in an async
 *  handler. Throws if used outside a `<ConfirmProvider>`. */
export function useConfirm(): ConfirmApi['confirm'] {
  return useConfirmApi().confirm;
}

/** Async acknowledgement (OK-only). Drop-in for `alert`. Throws if
 *  used outside a `<ConfirmProvider>`. */
export function useAlert(): ConfirmApi['alert'] {
  return useConfirmApi().alert;
}

function useConfirmApi(): ConfirmApi {
  const ctx = useContext(ConfirmContext);
  if (ctx === null) {
    throw new Error('useConfirm / useAlert must be used within a <ConfirmProvider>');
  }
  return ctx;
}
