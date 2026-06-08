import { describe, it, expect, vi } from 'vitest';
import { packBackup, unpackBackup } from './backup-pack';
import { sealBackup, openBackup } from '@/core/crypto/backup-crypto';

// The encrypted round-trip seals + opens via age scrypt (logN=18, pure JS,
// ~seconds each) — give it headroom over the 10s default under load.
vi.setConfig({ testTimeout: 45_000 });

const AT = '2026-06-08T10:00:00.000Z';
const PASS = 'correct horse battery staple 4291';

describe('backup pack/unpack', () => {
  it('lays modules out as per-module files + a manifest', () => {
    const files = packBackup(
      { mood: [{ score: 4 }], hrt_lab_results: [{ marker: 'estradiol' }] },
      AT,
    );
    expect(Object.keys(files).sort()).toEqual([
      'manifest.json',
      'modules/hrt_lab_results.json',
      'modules/mood.json',
    ]);
  });

  it('the manifest records format + the module list', () => {
    const files = packBackup({ mood: [], goals: [] }, AT);
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']!));
    expect(manifest.format).toBe('nodea-backup');
    expect(manifest.app).toBe('Nodea');
    expect(manifest.modules.sort()).toEqual(['goals', 'mood']);
  });

  it('unpack is the inverse of pack (manifest ignored)', () => {
    const modules = {
      mood: [{ date: '2026-06-01', score: 5 }],
      journal: [{ date: '2026-06-02', content: 'hello' }],
    };
    expect(unpackBackup(packBackup(modules, AT)).modules).toEqual(modules);
  });

  it('survives a full encrypted round-trip: pack → seal → open → unpack', async () => {
    const modules = {
      mood: [{ date: '2026-06-01', score: 5, note: 'éàç 🌈' }],
      hrt_admin_logs: [{ date: '2026-06-02', product: 'Estradiol gel', dose: 2 }],
    };
    const blob = await sealBackup(packBackup(modules, AT), PASS);
    const opened = await openBackup(blob, PASS);
    expect(unpackBackup(opened).modules).toEqual(modules);
  });
});
