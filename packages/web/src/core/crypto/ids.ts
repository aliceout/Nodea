/**
 * Random identifier helpers used by the module bootstrap layer.
 *
 * `module_user_id` is the anonymised per-module sub-identifier that
 * scopes every encrypted entry query (the `sid=` parameter). It is
 * generated once per module when the user enables it, stored in the
 * decrypted modules_config, and never leaves that map in clear (the
 * server only sees it through a transient route query-string).
 */
import { bytesToBase64Url, randomBytes } from './base64.ts';

/**
 * Generate a fresh `module_user_id` of the shape `<prefix><16-char b64url>`.
 * 12 random bytes → 16 characters, safely URL-encodable.
 */
export function generateModuleUserId(prefix = 'g_'): string {
  const id = bytesToBase64Url(randomBytes(12)).toLowerCase();
  return prefix + id;
}
