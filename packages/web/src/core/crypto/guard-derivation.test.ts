import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearGuardsCache,
  deleteEntryGuard,
  deriveGuard,
  getEntryGuard,
  setEntryGuard,
} from './guard-derivation.ts';
import { deriveMainKeys } from './key-material.ts';
import { randomBytes } from './base64.ts';

async function freshHmacKey() {
  const { hmacKey } = await deriveMainKeys(randomBytes(32));
  return hmacKey;
}

describe('deriveGuard', () => {
  it('is deterministic for the same (key, sid, recordId)', async () => {
    const hmacKey = await freshHmacKey();
    const a = await deriveGuard(hmacKey, 'sid-1', 'rec-1');
    const b = await deriveGuard(hmacKey, 'sid-1', 'rec-1');
    expect(a).toBe(b);
  });

  it('produces the shape g_<64 hex chars>', async () => {
    const g = await deriveGuard(await freshHmacKey(), 'sid', 'rec');
    expect(g).toMatch(/^g_[a-f0-9]{64}$/);
  });

  it('changes when the moduleUserId changes', async () => {
    const hmacKey = await freshHmacKey();
    const a = await deriveGuard(hmacKey, 'sid-a', 'rec');
    const b = await deriveGuard(hmacKey, 'sid-b', 'rec');
    expect(a).not.toBe(b);
  });

  it('changes when the recordId changes', async () => {
    const hmacKey = await freshHmacKey();
    const a = await deriveGuard(hmacKey, 'sid', 'rec-a');
    const b = await deriveGuard(hmacKey, 'sid', 'rec-b');
    expect(a).not.toBe(b);
  });

  it('changes when the HMAC key changes (different mainKey)', async () => {
    const a = await deriveGuard(await freshHmacKey(), 'sid', 'rec');
    const b = await deriveGuard(await freshHmacKey(), 'sid', 'rec');
    expect(a).not.toBe(b);
  });

  it('refuses empty moduleUserId or recordId', async () => {
    const hmacKey = await freshHmacKey();
    await expect(deriveGuard(hmacKey, '', 'r')).rejects.toThrow();
    await expect(deriveGuard(hmacKey, 's', '')).rejects.toThrow();
  });
});

describe('In-memory guard cache', () => {
  beforeEach(() => clearGuardsCache());

  it('stores and retrieves a guard per (collection, id)', () => {
    setEntryGuard('mood', 'r1', 'g_aaaa');
    setEntryGuard('goals', 'r1', 'g_bbbb');
    expect(getEntryGuard('mood', 'r1')).toBe('g_aaaa');
    expect(getEntryGuard('goals', 'r1')).toBe('g_bbbb');
    expect(getEntryGuard('mood', 'r2')).toBeUndefined();
  });

  it('deleteEntryGuard removes just that one', () => {
    setEntryGuard('mood', 'r1', 'g_x');
    setEntryGuard('mood', 'r2', 'g_y');
    deleteEntryGuard('mood', 'r1');
    expect(getEntryGuard('mood', 'r1')).toBeUndefined();
    expect(getEntryGuard('mood', 'r2')).toBe('g_y');
  });

  it('clearGuardsCache wipes everything', () => {
    setEntryGuard('mood', 'r1', 'g_x');
    setEntryGuard('goals', 'r2', 'g_y');
    clearGuardsCache();
    expect(getEntryGuard('mood', 'r1')).toBeUndefined();
    expect(getEntryGuard('goals', 'r2')).toBeUndefined();
  });

  it('never touches localStorage (structurally: we never imported it)', () => {
    // If this test ever needs to spy on localStorage it means we've reintroduced
    // a persistent cache — the finding would regress. Keep this test as a
    // documentation tripwire: the assertion is a smoke check that there's
    // nothing stored under the legacy key.
    if (typeof globalThis.localStorage !== 'undefined') {
      expect(globalThis.localStorage.getItem('nodea.guards.v1')).toBeNull();
    }
  });
});
