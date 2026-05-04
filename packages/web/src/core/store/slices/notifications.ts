/**
 * Notifications slice — transient toast queue rendered by the
 * top-level `Toaster`. Toasts are uniquely identified via
 * `crypto.randomUUID()` (browser-only path — Vitest under jsdom
 * exposes the same globalThis.crypto, so tests don't break).
 *
 * Sits inside `useNodeaStore` (Zustand slice pattern, see ADR-0013).
 */
import type { StateCreator } from 'zustand';
import type { NodeaState } from '../nodea-store.ts';

export interface ToastNotification {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface NotificationsSlice {
  notifications: ToastNotification[];
  pushToast(n: Omit<ToastNotification, 'id'>): void;
  dismissToast(id: string): void;
}

export const createNotificationsSlice: StateCreator<
  NodeaState,
  [],
  [],
  NotificationsSlice
> = (set) => ({
  notifications: [],
  pushToast: (n) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...n, id: crypto.randomUUID() },
      ],
    })),
  dismissToast: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((t) => t.id !== id),
    })),
});
