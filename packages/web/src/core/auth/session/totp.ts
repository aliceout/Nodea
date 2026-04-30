import type { TotpEnrollStartResponse } from '@nodea/shared';

import {
  apiMe,
  apiTotpDisable,
  apiTotpEnrollStart,
  apiTotpEnrollVerify,
  apiTotpRegenerateBackupCodes,
} from '../../api/client.ts';
import type { SessionUser } from '../../store/nodea-store.ts';

import { freshenReauth } from './freshen-reauth.ts';
import type { SetAuth } from './types.ts';

interface TotpDeps {
  user: SessionUser | null;
  setAuth: SetAuth;
}

/**
 * Drive a TOTP enrollment start: re-prove the password and ask the
 * server for a fresh secret + 10 backup codes. Returns the
 * `secretBase32`, `otpauthUri` (for QR rendering), and the codes —
 * all displayed once. The user must scan the QR / type the code,
 * then call `verifyTotpEnrollment` to flip the row from pending
 * to enabled.
 *
 * Throws `{ status: 401, error: 'invalid_credentials' }` on a wrong
 * password — same shape the rest of the hook surfaces.
 */
export async function startTotpEnrollment(
  deps: { user: SessionUser | null },
  currentPassword: string,
): Promise<TotpEnrollStartResponse> {
  if (!deps.user) throw new Error('startTotpEnrollment: no authenticated user');
  await freshenReauth(currentPassword);
  return apiTotpEnrollStart({});
}

/**
 * Confirm an enrollment with a TOTP code + the backup-codes ack.
 * On success the server flips `enabled_at`; we refresh `/me` so
 * the sidebar tip + Settings UI react.
 */
export async function verifyTotpEnrollment(
  deps: TotpDeps,
  code: string,
): Promise<void> {
  if (!deps.user) throw new Error('verifyTotpEnrollment: no authenticated user');
  await apiTotpEnrollVerify({ code, backupCodesAcknowledged: true });
  const me = await apiMe();
  if (me) deps.setAuth(me);
}

/**
 * Disable TOTP. Requires fresh password proof (matrice §6). Server
 * applies §6.1 downgrade auto if `security_mode` was
 * `always_totp` / `maximum`. Refreshes `/me` so the UI reflects
 * the new mode + flag.
 */
export async function disableTotp(
  deps: TotpDeps,
  currentPassword: string,
): Promise<void> {
  if (!deps.user) throw new Error('disableTotp: no authenticated user');
  await freshenReauth(currentPassword);
  await apiTotpDisable({});
  const me = await apiMe();
  if (me) deps.setAuth(me);
}

/**
 * Regenerate the 10 TOTP backup codes. Requires fresh password
 * proof. Refuses 400 if TOTP isn't enabled (would be regenerating
 * into a dead pool). Returns the fresh codes for one-shot display;
 * old codes are invalidated atomically.
 */
export async function regenerateTotpBackupCodes(
  deps: TotpDeps,
  currentPassword: string,
): Promise<string[]> {
  if (!deps.user) throw new Error('regenerateTotpBackupCodes: no authenticated user');
  await freshenReauth(currentPassword);
  const res = await apiTotpRegenerateBackupCodes({});
  // Refresh /me — the count should still be 10, but the field
  // is non-stale after this call too.
  const me = await apiMe();
  if (me) deps.setAuth(me);
  return res.backupCodes;
}
