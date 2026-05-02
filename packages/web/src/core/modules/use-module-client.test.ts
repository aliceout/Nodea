// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { MainKeyMaterial } from '@/core/crypto/key-material';
import { useNodeaStore } from '@/core/store/nodea-store';

import { useModuleClient } from './use-module-client.ts';

/** Minimal `MainKeyMaterial` test double — the hook never inspects
 *  the crypto keys, it just narrows on truthiness, so a plain
 *  object cast is enough. */
const fakeMainKey = {} as MainKeyMaterial;

describe('useModuleClient', () => {
  afterEach(() => {
    useNodeaStore.getState().resetAll();
  });

  it('returns null when the main key is not set', () => {
    useNodeaStore.getState().setModules({
      goals: { enabled: true, moduleUserId: 'sid-goals' },
    });
    const { result } = renderHook(() => useModuleClient('goals'));
    expect(result.current).toBeNull();
  });

  it('returns null when the module is not hydrated', () => {
    useNodeaStore.getState().setMainKey(fakeMainKey);
    const { result } = renderHook(() => useModuleClient('goals'));
    expect(result.current).toBeNull();
  });

  it('returns null when the module is enabled but has no moduleUserId', () => {
    useNodeaStore.getState().setMainKey(fakeMainKey);
    useNodeaStore.getState().setModules({
      goals: { enabled: true },
    });
    const { result } = renderHook(() => useModuleClient('goals'));
    expect(result.current).toBeNull();
  });

  it('returns the narrowed pair when both are set', () => {
    useNodeaStore.getState().setMainKey(fakeMainKey);
    useNodeaStore.getState().setModules({
      goals: { enabled: true, moduleUserId: 'sid-goals' },
    });
    const { result } = renderHook(() => useModuleClient('goals'));
    expect(result.current).toEqual({
      mainKey: fakeMainKey,
      moduleUserId: 'sid-goals',
    });
  });

  it('returns a stable reference across re-renders when inputs are unchanged', () => {
    useNodeaStore.getState().setMainKey(fakeMainKey);
    useNodeaStore.getState().setModules({
      goals: { enabled: true, moduleUserId: 'sid-goals' },
    });
    const { result, rerender } = renderHook(() => useModuleClient('goals'));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('returns a fresh reference when the moduleUserId changes', () => {
    useNodeaStore.getState().setMainKey(fakeMainKey);
    useNodeaStore.getState().setModules({
      goals: { enabled: true, moduleUserId: 'sid-goals-1' },
    });
    const { result, rerender } = renderHook(() => useModuleClient('goals'));
    const first = result.current;

    useNodeaStore.getState().setModules({
      goals: { enabled: true, moduleUserId: 'sid-goals-2' },
    });
    rerender();
    expect(result.current).not.toBe(first);
    expect(result.current?.moduleUserId).toBe('sid-goals-2');
  });

  it('isolates per moduleId', () => {
    useNodeaStore.getState().setMainKey(fakeMainKey);
    useNodeaStore.getState().setModules({
      goals: { enabled: true, moduleUserId: 'sid-goals' },
      mood: { enabled: true, moduleUserId: 'sid-mood' },
    });
    const { result: g } = renderHook(() => useModuleClient('goals'));
    const { result: m } = renderHook(() => useModuleClient('mood'));
    expect(g.current?.moduleUserId).toBe('sid-goals');
    expect(m.current?.moduleUserId).toBe('sid-mood');
  });
});
