import { describe, it, expect } from 'vitest';
import { deriveGuard } from './guard-derivation.ts';
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

describe('Guard persistence tripwire', () => {
  // The in-memory guard cache was removed (audit 2026-06) — it was
  // dead code whose header claimed a logout purge nobody performed.
  // This tripwire stays : if a future cache ever persists guards
  // under the legacy localStorage key, this fails before review.
  it('never touches localStorage', () => {
    if (typeof globalThis.localStorage !== 'undefined') {
      expect(globalThis.localStorage.getItem('nodea.guards.v1')).toBeNull();
    }
  });
});
