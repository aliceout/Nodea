import { describe, it, expect, beforeEach } from 'vitest';
import { useNodeaStore, type SessionUser } from './nodea-store.ts';

const sampleUser: SessionUser = {
  id: 'u-1',
  email: 'alice@example.com',
  username: null,
  role: 'user',
  onboardingStatus: 'complete',
  onboardingVersion: '1',
  wrappedMainKey: 'iv.data',
  wrappedMainKeyIv: 'iv',
  wrappedKekPassword: 'kek-iv.kek-data',
  wrappedKekPasswordIv: 'kek-iv',
  recoveryCodeSet: false,
};

describe('useNodeaStore', () => {
  beforeEach(() => {
    useNodeaStore.getState().resetAll();
  });

  it('starts in an unauthenticated state with no crypto and no modules', () => {
    const s = useNodeaStore.getState();
    expect(s.auth.status).toBe('unauthenticated');
    expect(s.auth.user).toBeNull();
    expect(s.crypto.status).toBe('idle');
    expect(s.crypto.main).toBeNull();
    expect(s.modules).toEqual({});
    expect(s.notifications).toEqual([]);
  });

  it('setAuth transitions to authenticated with a user, or back to unauthenticated on null', () => {
    useNodeaStore.getState().setAuth(sampleUser);
    expect(useNodeaStore.getState().auth).toEqual({ status: 'authenticated', user: sampleUser });

    useNodeaStore.getState().setAuth(null);
    expect(useNodeaStore.getState().auth).toEqual({ status: 'unauthenticated', user: null });
  });

  it('setAuthLoading puts the store in a transient loading state', () => {
    useNodeaStore.getState().setAuthLoading();
    expect(useNodeaStore.getState().auth.status).toBe('loading');
    expect(useNodeaStore.getState().auth.user).toBeNull();
  });

  it('markKeyMissing flips crypto status to missing', () => {
    useNodeaStore.getState().markKeyMissing();
    expect(useNodeaStore.getState().crypto).toEqual({ status: 'missing', main: null });
  });

  it('setModules replaces the whole runtime, updateModule merges one slot', () => {
    useNodeaStore.getState().setModules({ mood: { enabled: true, moduleUserId: 'sid-1' } });
    expect(useNodeaStore.getState().modules.mood).toEqual({
      enabled: true,
      moduleUserId: 'sid-1',
    });

    useNodeaStore.getState().updateModule('mood', { algo: 'v1' });
    expect(useNodeaStore.getState().modules.mood).toEqual({
      enabled: true,
      moduleUserId: 'sid-1',
      algo: 'v1',
    });

    useNodeaStore.getState().updateModule('goals', { enabled: true });
    expect(useNodeaStore.getState().modules.goals).toEqual({ enabled: true });
  });

  it('push/dismiss toast lifecycle', () => {
    useNodeaStore.getState().pushToast({ kind: 'info', message: 'hello' });
    useNodeaStore.getState().pushToast({ kind: 'error', message: 'bad' });
    const toasts = useNodeaStore.getState().notifications;
    expect(toasts).toHaveLength(2);

    useNodeaStore.getState().dismissToast(toasts[0]!.id);
    expect(useNodeaStore.getState().notifications).toHaveLength(1);
    expect(useNodeaStore.getState().notifications[0]?.message).toBe('bad');
  });

  it('resetAll wipes everything', () => {
    const s = useNodeaStore.getState();
    s.setAuth(sampleUser);
    s.setModules({ mood: { enabled: true } });
    s.pushToast({ kind: 'info', message: 'x' });

    s.resetAll();
    const after = useNodeaStore.getState();
    expect(after.auth.user).toBeNull();
    expect(after.modules).toEqual({});
    expect(after.notifications).toEqual([]);
    expect(after.crypto.main).toBeNull();
  });
});
