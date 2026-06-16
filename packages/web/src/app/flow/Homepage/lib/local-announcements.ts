import { selectUser, useNodeaStore } from '@/core/store/nodea-store';

/**
 * Client-generated onboarding / security tips, surfaced through the
 * SAME Homepage announcements card as admin-pushed announcements —
 * one display location instead of a separate sidebar tip slot.
 *
 * Why fold them in : each tip's `id` (`local:*`) is dismissed through
 * the same `preferences.dismissedAnnouncements` array as server
 * announcements, so a dismissal is encrypted, syncs across devices,
 * and is permanent. The old sidebar tips dismissed via `localStorage`,
 * which the logout purge wiped — hence « the astuce keeps coming back ».
 *
 * Non-dismissable tips (the recovery-code warning) carry no × and stay
 * until the underlying condition clears (`recoveryCodeSet` flips true) —
 * losing the password without a code means a destructive reset, so the
 * user should act on it rather than silence it.
 *
 * Tips are generated from user state, so they auto-resolve : enrol TOTP
 * and `local:totp` stops being produced; set a recovery code and
 * `local:recovery` disappears.
 */
export type LocalTipKind = 'info' | 'warning' | 'danger';

export interface LocalTip {
  /** Stable id, also the key in `dismissedAnnouncements`. */
  id: string;
  kind: LocalTipKind;
  titleKey: string;
  bodyKey: string;
  /** i18n key for the call-to-action label (a « → » is appended in the
   *  card). */
  actionKey: string;
  /** Route target (react-router `Link`). Mutually exclusive with
   *  `module`. */
  to?: string;
  /** In-app module-switch target (no route change — preserves the
   *  `/flow` privacy invariant). */
  module?: 'account';
  /** When false, no × button and the tip ignores the dismissed set. */
  dismissable: boolean;
}

export function useLocalAnnouncements(): LocalTip[] {
  const user = useNodeaStore(selectUser);
  if (user === null) return [];

  const tips: LocalTip[] = [];

  // Data-loss prevention — non-dismissable, clears once a code is set.
  if (user.recoveryCodeSet === false) {
    tips.push({
      id: 'local:recovery',
      kind: 'danger',
      titleKey: 'home.tips.recovery.title',
      bodyKey: 'home.tips.recovery.body',
      actionKey: 'home.tips.recovery.action',
      to: '/recovery-code',
      dismissable: false,
    });
  }

  // Opt-in security upgrade — dismissable.
  if (user.totpEnabled === false) {
    tips.push({
      id: 'local:totp',
      kind: 'warning',
      titleKey: 'home.tips.totp.title',
      bodyKey: 'home.tips.totp.body',
      actionKey: 'home.tips.totp.action',
      to: '/totp',
      dismissable: true,
    });
  }

  // First-run nudge — dismissable, shown until acknowledged.
  tips.push({
    id: 'local:modules',
    kind: 'info',
    titleKey: 'home.tips.modules.title',
    bodyKey: 'home.tips.modules.body',
    actionKey: 'home.tips.modules.action',
    module: 'account',
    dismissable: true,
  });

  return tips;
}
