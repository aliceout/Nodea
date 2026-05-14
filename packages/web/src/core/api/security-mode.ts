import type { SecurityMode, SecurityModeChangeBody } from '@nodea/shared';

import { request } from './internal.ts';

/**
 * Change the user's `security_mode` (Auth-Roadmap Phase 5D).
 * Server validates the §6.1 prerequisites and refuses with `400
 * totp_required` / `400 passkey_required` when missing. Refresh
 * `/auth/me` after a successful change so the store reflects the
 * new mode.
 */
export async function apiSecurityModeChange(
  body: SecurityModeChangeBody,
): Promise<{ ok: true; mode: SecurityMode }> {
  return request<{ ok: true; mode: SecurityMode }>(
    'POST',
    '/auth/security-mode/change',
    body,
  );
}
