/**
 * Pack/unpack the per-module structure carried *inside* the encrypted
 * backup.
 *
 * The backup is "Option 2": an opaque `age` blob (see
 * `core/crypto/backup-crypto`) wrapping a ZIP that holds one JSON per
 * module plus a manifest. This module owns only that inner layout —
 * `packBackup` lays the collected modules out as `modules/<key>.json` +
 * `manifest.json`; `unpackBackup` reverses it back into the same
 * `{ modules }` shape the import flow already consumes. Kept separate from
 * the crypto and the UI so the shape stays unit-testable on its own, with
 * no `age`/passphrase in the loop.
 */
import type { BackupFiles } from '@/core/crypto/backup-crypto';

const BACKUP_FORMAT = 'nodea-backup';
const BACKUP_VERSION = 1;
const MODULE_FILE = /^modules\/(.+)\.json$/;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: 'Nodea';
  exported_at: string;
  /** Module keys present as `modules/<key>.json` — informational; the
   *  restore reads the actual files, not this list. */
  modules: string[];
  /** Module keys that the export tried to collect but couldn't
   *  serialise (decrypt error, schema mismatch, network blip on a
   *  paginated fetch). Present only when at least one module failed ;
   *  the missing modules are NOT in `modules` and have no
   *  `modules/<key>.json` file. Versions that don't know about this
   *  field (Nodea ≤ v2.8.0) ignore it cleanly because the JSON.parse
   *  in `unpackBackup` reads the manifest only as informational. */
  failed_modules?: string[];
}

/**
 * Lay the collected `{ moduleKey: payload[] }` map out as the backup's
 * inner files: one `modules/<key>.json` per module + a `manifest.json`.
 * `exportedAt` is passed in (the crypto layer forbids `new Date()` deep
 * down; here the caller stamps it once for both the manifest and the
 * download name).
 *
 * When the export caller couldn't serialise some modules (e.g. a
 * decrypt error mid-collect, a per-module size cap exceeded), pass them
 * in `failedModules` so the manifest records the gap. Restoring a
 * backup with `failed_modules` is still legal — the missing keys just
 * don't show up in `unpackBackup`'s output ; the user is warned via
 * the export UI that the backup is partial.
 */
export function packBackup(
  modules: Record<string, unknown[]>,
  exportedAt: string,
  failedModules: string[] = [],
): BackupFiles {
  const keys = Object.keys(modules);
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: 'Nodea',
    exported_at: exportedAt,
    modules: keys,
    ...(failedModules.length > 0 ? { failed_modules: failedModules } : {}),
  };
  const files: BackupFiles = {
    'manifest.json': encoder.encode(JSON.stringify(manifest, null, 2)),
  };
  for (const key of keys) {
    files[`modules/${key}.json`] = encoder.encode(
      JSON.stringify(modules[key] ?? [], null, 2),
    );
  }
  return files;
}

/**
 * Reverse {@link packBackup}: read every `modules/<key>.json` back into a
 * `{ modules }` envelope (the manifest is skipped — it's informational).
 * Non-array module files are ignored defensively.
 *
 * **Resilience to partial corruption (audit v2.8.0).** A single
 * malformed `modules/<key>.json` (JSON.parse throws, or the parsed
 * value isn't an array) used to abort the whole loop and lose every
 * other module the user had backed up. We now skip the bad file and
 * record it in `failedModules` so the caller can warn the user, while
 * the rest of the backup restores cleanly.
 */
export function unpackBackup(files: BackupFiles): {
  modules: Record<string, unknown[]>;
  failedModules: string[];
} {
  const modules: Record<string, unknown[]> = {};
  const failedModules: string[] = [];
  for (const [name, bytes] of Object.entries(files)) {
    const match = MODULE_FILE.exec(name);
    const key = match?.[1];
    if (!key) continue; // manifest.json or anything unexpected
    try {
      const parsed: unknown = JSON.parse(decoder.decode(bytes));
      if (Array.isArray(parsed)) {
        modules[key] = parsed;
      } else {
        failedModules.push(key);
      }
    } catch {
      failedModules.push(key);
    }
  }
  return { modules, failedModules };
}
