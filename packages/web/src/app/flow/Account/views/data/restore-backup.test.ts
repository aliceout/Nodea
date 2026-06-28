import { describe, it, expect, beforeAll, vi } from 'vitest';

import { deriveMainKeys, type MainKeyMaterial } from '@/core/crypto/key-material';
import { deriveBackupPhrase } from '@/core/crypto/backup-phrase';
import { sealBackup } from '@/core/crypto/backup-crypto';

import { packBackup } from './backup-pack';
import { restoreFromAgeBytes, tryAutoRestore } from './restore-backup';

// age passphrase mode runs scrypt (logN=18) in pure JS — a seal + several opens
// is seconds of real work; allow headroom under CI / concurrent load. The seal +
// 2× key derivation run in beforeAll, so raise hookTimeout too: it's SEPARATE
// from testTimeout, and the 10s default was timing the hook out (→ 6 skipped,
// file failed) under parallel load while passing in isolation.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// i18n stub: restoreEnvelope formats `parts` lines with `t`; returning the key
// keeps assertions independent of locale.
const t = (key: string): string => key;

const ISO = '2026-06-28T00:00:00.000Z';

// One module key the import registry doesn't know → restore SKIPS it cleanly
// (no plugin run, no store needed). We're pinning the crypto round-trip and
// tryAutoRestore's silent-first / ask-on-mismatch contract, not the per-module
// merge (covered by restore-envelope's own consumers).
const FIXTURE = { __nodea_test_unknown__: [] };

describe('restore-backup', () => {
  let key: MainKeyMaterial;
  let foreignKey: MainKeyMaterial;
  let phraseV1: string;
  let blob: Uint8Array;

  beforeAll(async () => {
    key = await deriveMainKeys(new Uint8Array(32).fill(3));
    foreignKey = await deriveMainKeys(new Uint8Array(32).fill(9));
    phraseV1 = await deriveBackupPhrase(key.hmacKey, 1);
    blob = await sealBackup(packBackup(FIXTURE, ISO), phraseV1);
  });

  it('round-trips: restoreFromAgeBytes opens the sealed blob with the matching phrase', async () => {
    const res = await restoreFromAgeBytes(blob, phraseV1, key, {}, t);
    // Unknown module is skipped, so nothing merges — but the seal→open→unpack
    // →envelope pipeline ran end-to-end without a corrupted-module failure.
    expect(res.count).toBe(0);
    expect(res.hadFailures).toBe(false);
  });

  it('restoreFromAgeBytes THROWS on a wrong phrase (the signal tryAutoRestore catches)', async () => {
    const wrong = await deriveBackupPhrase(key.hmacKey, 2);
    await expect(restoreFromAgeBytes(blob, wrong, key, {}, t)).rejects.toBeDefined();
  });

  it('tryAutoRestore decrypts THIS account silently (ok:true, no words needed)', async () => {
    const res = await tryAutoRestore(blob, key, 1, {}, t);
    expect(res.ok).toBe(true);
    expect(res.hadFailures).toBe(false);
  });

  it('tryAutoRestore returns ok:false (never throws) when the version rotated', async () => {
    // v2 derives a different phrase than the one the blob was sealed under.
    const res = await tryAutoRestore(blob, key, 2, {}, t);
    expect(res.ok).toBe(false);
  });

  it('tryAutoRestore returns ok:false for a backup from a DIFFERENT account', async () => {
    // The whole point of the fallback: a foreign blob can't be auto-opened, so
    // the UI asks for the 12 words instead of silently failing.
    const res = await tryAutoRestore(blob, foreignKey, 1, {}, t);
    expect(res.ok).toBe(false);
  });

  it('tryAutoRestore returns ok:false (not a throw) on a tampered blob', async () => {
    const tampered = blob.slice();
    const i = tampered.length - 1;
    tampered[i] = tampered[i]! ^ 0xff;
    const res = await tryAutoRestore(tampered, key, 1, {}, t);
    expect(res.ok).toBe(false);
  });
});
