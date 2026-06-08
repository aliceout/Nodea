import { describe, it, expect, vi } from 'vitest';
import { sealBackup, openBackup, type BackupFiles } from './backup-crypto.ts';

// age passphrase mode runs scrypt at logN=18 in pure JS (~seconds per
// derivation); a seal+open round-trip does two, and can exceed the 10s
// default under CI / concurrent load. Generous timeout, real work factor.
vi.setConfig({ testTimeout: 45_000 });

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Build a backup from `{ name: utf8String }` for readable fixtures. */
function makeFiles(text: Record<string, string>): BackupFiles {
  return Object.fromEntries(
    Object.entries(text).map(([name, body]) => [name, enc.encode(body)]),
  );
}

/** Decode a backup's files back to `{ name: utf8String }` for assertions. */
function readFiles(files: BackupFiles): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([name, bytes]) => [name, dec.decode(bytes)]),
  );
}

const PASSPHRASE = 'correct horse battery staple 4291';

describe('backup seal/open round-trip', () => {
  it('opens back to the exact same files (multi-module)', async () => {
    const source = makeFiles({
      'mood.json': '[{"score":4,"note":"éàçü 🌤️"}]',
      'goals.json': '[{"title":"ship the backup"}]',
      'hrt.json': '{"labs":[{"marker":"estradiol","value":250}]}',
    });
    const blob = await sealBackup(source, PASSPHRASE);
    const opened = await openBackup(blob, PASSPHRASE);
    expect(readFiles(opened)).toEqual(readFiles(source));
  });

  it('round-trips a large payload byte-for-byte', async () => {
    const source = makeFiles({ 'journal.json': 'a'.repeat(200_000) });
    const blob = await sealBackup(source, PASSPHRASE);
    const opened = await openBackup(blob, PASSPHRASE);
    expect(opened['journal.json']).toEqual(source['journal.json']);
  });

  it('produces a real, opaque `age` file', async () => {
    const blob = await sealBackup(
      makeFiles({ 'mood.json': 'TOP_SECRET_MARKER' }),
      PASSPHRASE,
    );
    const asText = new TextDecoder('latin1').decode(blob);
    // age's binary format still opens with this ASCII header line.
    expect(asText.startsWith('age-encryption.org/v1')).toBe(true);
    // The plaintext must not survive in the clear anywhere in the blob.
    expect(asText).not.toContain('TOP_SECRET_MARKER');
  });

  it('is non-deterministic (fresh file key + salt each time)', async () => {
    const source = makeFiles({ 'mood.json': 'same input' });
    const a = await sealBackup(source, PASSPHRASE);
    const b = await sealBackup(source, PASSPHRASE);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe('backup open failure modes', () => {
  it('rejects a wrong passphrase', async () => {
    const blob = await sealBackup(makeFiles({ 'mood.json': 'x' }), PASSPHRASE);
    await expect(openBackup(blob, 'a different passphrase')).rejects.toBeDefined();
  });

  it('rejects a tampered blob', async () => {
    const blob = await sealBackup(makeFiles({ 'mood.json': 'x' }), PASSPHRASE);
    // Flip a byte in the encrypted payload (well past the ASCII header).
    const tampered = blob.slice();
    const i = tampered.length - 1;
    tampered[i] = tampered[i]! ^ 0xff;
    await expect(openBackup(tampered, PASSPHRASE)).rejects.toBeDefined();
  });

  it('refuses to seal an empty backup', async () => {
    await expect(sealBackup({}, PASSPHRASE)).rejects.toThrow(/empty backup/);
  });
});
