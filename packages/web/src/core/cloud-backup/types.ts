/**
 * Cloud-backup provider seam.
 *
 * WHAT  The single interface every storage backend implements, so the
 *       orchestrator (`cloud-push`) and the UI stay provider-agnostic: they
 *       dispatch by `cloudBackup.provider` through the registry and never know
 *       whether they're talking to Dropbox, pCloud or a WebDAV server.
 * WHERE `core/cloud-backup`. Each provider's quirks (OAuth refresh vs a
 *       non-expiring token vs HTTP Basic auth) are its own private business;
 *       only `connect` / `upload` / `revoke` cross this boundary.
 * WHY   ADR-0017 anticipated extracting this seam at the SECOND provider, not
 *       the first — so it lands now that pCloud + WebDAV join Dropbox.
 */
import type { CloudBackup, WebdavCredentials } from '@nodea/shared';

/** Single rolling backup file name, shared by every provider (ADR-0017: one
 *  file, overwritten each push; no dated history yet). */
export const BACKUP_FILENAME = 'nodea-backup-latest.age';

export interface CloudProvider {
  /** Discriminator — matches `CloudBackup['provider']`. */
  readonly id: CloudBackup['provider'];
  /**
   * How the user connects — drives whether the UI pops an OAuth window or
   * renders a credentials form:
   *   - `'oauth'`       → `connect()` runs a consent popup (Dropbox, pCloud).
   *   - `'credentials'` → the UI collects a form and passes it to
   *                       `connect(input)` (WebDAV: server URL + login +
   *                       app-password).
   */
  readonly connectKind: 'oauth' | 'credentials';
  /** Run the connect flow and return the credential to persist into the
   *  encrypted preferences. OAuth providers ignore `input`; credential
   *  providers require it. */
  connect(input?: WebdavCredentials): Promise<CloudBackup>;
  /** Upload the sealed `.age` bytes, overwriting the rolling backup file. The
   *  registry guarantees `cred.provider === this.id`. */
  upload(cred: CloudBackup, bytes: Uint8Array): Promise<void>;
  /** Best-effort: sever access at the provider on disconnect. Optional —
   *  pCloud/WebDAV have nothing to revoke browser-side (the caller just clears
   *  the local credential). */
  revoke?(cred: CloudBackup): Promise<void>;
}
