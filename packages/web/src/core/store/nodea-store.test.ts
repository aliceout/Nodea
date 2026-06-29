import { describe, it, expect, beforeEach } from 'vitest';
import { useNodeaStore, type SessionUser } from './nodea-store.ts';

const sampleUser: SessionUser = {
  id: 'u-1',
  email: 'alice@example.com',
  username: null,
  role: 'user',
  onboardingStatus: 'complete',
  onboardingVersion: '1',
  recoveryCodeSet: false,
  recoveryReverifyDue: false,
  passkeysCount: 0,
  passkeysPrfCount: 0,
  totpEnabled: false,
  totpBackupCodesRemaining: 0,
  securityMode: 'password_or_passkey',
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

  it('hydrateModules applies only when no local write raced (3.6)', () => {
    // Simulate the first-login race : a hydration GET captures the seq,
    // then the seed writes the config before the GET resolves.
    const baseline = useNodeaStore.getState().modulesWriteSeq;

    // Seed lands first (a local write — bumps the seq).
    useNodeaStore
      .getState()
      .setModules({ mood: { enabled: true, moduleUserId: 'seeded' } });

    // The stale GET now tries to apply an empty config with the old
    // baseline — it must be ignored, the seeded config survives.
    useNodeaStore.getState().hydrateModules({}, baseline);
    expect(useNodeaStore.getState().modules.mood).toEqual({
      enabled: true,
      moduleUserId: 'seeded',
    });

    // A hydration with the CURRENT seq (no race) does apply.
    const fresh = useNodeaStore.getState().modulesWriteSeq;
    useNodeaStore
      .getState()
      .hydrateModules({ goals: { enabled: true, moduleUserId: 'srv' } }, fresh);
    expect(useNodeaStore.getState().modules).toEqual({
      goals: { enabled: true, moduleUserId: 'srv' },
    });
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

  // The flow slice's `setModule` also calls `window.history.pushState`
  // so the back button works. Vitest runs under `node` env (no `window`),
  // so the store guards on `typeof window !== 'undefined'` and these
  // tests cover the store mutation only — the browser history pairing
  // is verified by integration / manual click-through.
  describe('flow slice', () => {
    it('starts on home with the default library subview', () => {
      const s = useNodeaStore.getState();
      expect(s.flow.currentModule).toBe('home');
      expect(s.flow.librarySubview).toBe('livres');
    });

    it('setModule updates currentModule', () => {
      useNodeaStore.getState().setModule('library');
      expect(useNodeaStore.getState().flow.currentModule).toBe('library');
    });

    it('setModule is a no-op when target equals current', () => {
      useNodeaStore.getState().setModule('library');
      const before = useNodeaStore.getState().flow;
      useNodeaStore.getState().setModule('library');
      // Same object reference because the no-op early-returns before set().
      // This is the behaviour that prevents duplicate browser history
      // entries on double-clicks of the same sidebar item.
      expect(useNodeaStore.getState().flow).toBe(before);
    });

    it('syncCurrentModule updates currentModule (used by popstate listener)', () => {
      useNodeaStore.getState().setModule('library');
      useNodeaStore.getState().syncCurrentModule('goals');
      expect(useNodeaStore.getState().flow.currentModule).toBe('goals');
    });

    it('setLibrarySubview swaps the active Library lens', () => {
      useNodeaStore.getState().setLibrarySubview('extraits');
      expect(useNodeaStore.getState().flow.librarySubview).toBe('extraits');
    });

    it('resetAll resets the flow slice to home + livres', () => {
      const s = useNodeaStore.getState();
      s.setModule('library');
      s.setLibrarySubview('notes');
      s.resetAll();
      const after = useNodeaStore.getState();
      expect(after.flow.currentModule).toBe('home');
      expect(after.flow.librarySubview).toBe('livres');
    });
  });
});
