// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';

import { useNodeaStore } from '@/core/store/nodea-store';
import type { SessionUser } from '@/core/store/slices/auth';

import { useLocalAnnouncements } from './local-announcements';

/**
 * Guards the recovery tip priority in `useLocalAnnouncements`. The amber
 * re-verify tip is an `else if` UNDER the red « no code » tip, so the
 * branch is load-bearing: a code-less account must show ONLY the red
 * data-loss tip, and the amber re-verify tip must appear only when a code
 * IS set AND it's due. A regression (two `if`s instead of if/else) would
 * leak the amber nudge to users who have no code at all.
 */
function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'u1',
    email: 'a@b.co',
    username: null,
    role: 'user',
    onboardingStatus: 'complete',
    onboardingVersion: '1',
    recoveryCodeSet: true,
    recoveryReverifyDue: false,
    passkeysCount: 1,
    passkeysPrfCount: 1,
    totpEnabled: true,
    totpBackupCodesRemaining: 10,
    securityMode: 'password_or_passkey',
    ...overrides,
  };
}

function tipsFor(u: SessionUser | null) {
  useNodeaStore.getState().setAuth(u);
  return renderHook(() => useLocalAnnouncements()).result.current;
}

afterEach(cleanup);
beforeEach(() => {
  useNodeaStore.getState().setAuth(null);
});

describe('useLocalAnnouncements — recovery tip branching', () => {
  it('returns [] when there is no user', () => {
    expect(tipsFor(null)).toEqual([]);
  });

  it('no code set → red data-loss tip, NOT the amber re-verify tip (even when due)', () => {
    const tips = tipsFor(user({ recoveryCodeSet: false, recoveryReverifyDue: true }));
    const ids = tips.map((t) => t.id);
    expect(ids).toContain('local:recovery');
    expect(ids).not.toContain('local:recovery-reverify');
    expect(tips.find((t) => t.id === 'local:recovery')!.kind).toBe('danger');
  });

  it('code set + due → amber re-verify tip (warning, non-dismissable, → /recovery-reverify), NOT the red tip', () => {
    const tips = tipsFor(user({ recoveryCodeSet: true, recoveryReverifyDue: true }));
    const reverify = tips.find((t) => t.id === 'local:recovery-reverify');
    expect(reverify).toBeDefined();
    expect(reverify!.kind).toBe('warning');
    expect(reverify!.dismissable).toBe(false);
    expect(reverify!.to).toBe('/recovery-reverify');
    expect(tips.map((t) => t.id)).not.toContain('local:recovery');
  });

  it('code set + not due → neither recovery tip', () => {
    const ids = tipsFor(user({ recoveryCodeSet: true, recoveryReverifyDue: false })).map(
      (t) => t.id,
    );
    expect(ids).not.toContain('local:recovery');
    expect(ids).not.toContain('local:recovery-reverify');
  });

  it('does not shadow the sibling tips (totp / modules still emitted alongside)', () => {
    const ids = tipsFor(
      user({ recoveryCodeSet: true, recoveryReverifyDue: true, totpEnabled: false }),
    ).map((t) => t.id);
    expect(ids).toContain('local:recovery-reverify');
    expect(ids).toContain('local:totp');
    expect(ids).toContain('local:modules');
  });
});
