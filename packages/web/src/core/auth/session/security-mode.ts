import type { SecurityMode } from '@nodea/shared';

import {
  apiMe,
  apiMfaBypassRequest,
  apiSecurityModeChange,
} from '../../api/client.ts';
import type { SessionUser } from '../../store/nodea-store.ts';

import { freshenReauth } from './freshen-reauth.ts';
import type { SetAuth } from './types.ts';

/**
 * Request a bypass for a single MFA factor from the
 * `/login/mfa` blocked screen (Auth-Roadmap Phase 6, Auth-Spec
 * §7.8). Returns the earliest possible apply timestamp so the
 * UI can render "tu pourras te connecter sans <factor> à partir
 * du <date>".
 *
 * Throws ApiError shapes:
 *   - 409 `multi_factor_loss` — the §6.2 wall fires (mode max +
 *     two factors lost). Caller routes to the destructive reset.
 *   - 409 `bypass_already_active` — a request is already in
 *     flight; nothing to do.
 *   - 400 `factor_not_required` — degenerate state (mode demoted
 *     mid-session). Caller refreshes /me and recomputes.
 */
export async function requestMfaBypass(
  factor: 'totp' | 'passkey',
): Promise<{ earliestApplyAt: string }> {
  return apiMfaBypassRequest({ factor });
}

/**
 * Change the user's `security_mode` (Auth-Roadmap Phase 5D).
 * Requires fresh password proof (matrice §6). Server validates
 * §6.1 prerequisites — caller catches `totp_required` /
 * `passkey_required` 400 errors to surface the right CTA in the
 * UI ("active TOTP first" / "enroll a passkey first").
 */
export async function changeSecurityMode(
  deps: { user: SessionUser | null; setAuth: SetAuth },
  mode: SecurityMode,
  currentPassword: string,
): Promise<void> {
  if (!deps.user) throw new Error('changeSecurityMode: no authenticated user');
  await freshenReauth(currentPassword);
  await apiSecurityModeChange({ mode });
  // Refresh /me so the store reflects the new mode + the UI gates
  // recompute (e.g. the disable-TOTP button gains the "will
  // downgrade to password_or_passkey" warning).
  const me = await apiMe();
  if (me) deps.setAuth(me);
}
