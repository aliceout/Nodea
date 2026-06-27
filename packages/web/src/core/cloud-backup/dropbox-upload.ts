/**
 * Dropbox content upload — push the sealed `.age` into the app folder.
 *
 * WHERE `core/cloud-backup`, sibling to `dropbox-oauth`. Hits Dropbox's content
 * domain directly (ADR-0017 — no backend); the bytes are already E2E-encrypted,
 * so Dropbox only ever stores an opaque blob.
 * ASSUMPTIONS
 *   - The Dropbox app is an "App folder" app, so `path` is relative to
 *     `/Apps/<AppName>/` — `/nodea-backup-latest.age` lands there, never in the
 *     user's wider Dropbox.
 *   - `mode: overwrite` = the single rolling file decided in ADR-0017 (no dated
 *     history yet). `mute: true` stops Dropbox notifying the user on every
 *     silent push.
 */
const UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';

/** Backup file name in the Dropbox app folder. Single rolling file,
 *  overwritten each push (ADR-0017). */
export const BACKUP_FILENAME = 'nodea-backup-latest.age';

/** Upload the sealed `.age` bytes, overwriting the rolling backup file. */
export async function uploadToDropbox(
  accessToken: string,
  bytes: Uint8Array,
): Promise<void> {
  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: `/${BACKUP_FILENAME}`,
        mode: 'overwrite',
        mute: true,
      }),
    },
    body: bytes as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`Dropbox upload failed (${res.status})`);
  }
}
