/**
 * Active-sessions API client (issue #47).
 *
 * Wraps the four endpoints behind the « Sessions actives » UI :
 *   - GET    /auth/sessions
 *   - DELETE /auth/sessions/:id          (requires fresh password re-auth)
 *   - POST   /auth/logout-all             (requires fresh password re-auth)
 *   - PATCH  /auth/sessions/current/device-label
 *
 * The server never sees the cleartext device label — the client
 * encrypts it locally via `core/crypto/session-meta.ts` before
 * calling `apiPatchCurrentSessionDeviceLabel`. Decryption of the
 * labels returned by `apiListActiveSessions` happens in the
 * consumer (SessionsCard) since the AES sub-key lives in memory
 * there.
 */
import {
  ListActiveSessionsResponseSchema,
  type ListActiveSessionsResponse,
  type PatchCurrentSessionDeviceLabelBody,
} from '@nodea/shared';

import { request } from './internal.ts';

export async function apiListActiveSessions(): Promise<ListActiveSessionsResponse> {
  return request(
    'GET',
    '/auth/sessions',
    undefined,
    ListActiveSessionsResponseSchema,
  );
}

export async function apiRevokeSession(id: string): Promise<void> {
  // The server route is `/auth/sessions/:id` — we URL-encode the id
  // to be safe against any future change in the id format. Today
  // ids are 256-bit base64url with no path-unsafe chars, but the
  // encoder is free.
  await request<void>('DELETE', `/auth/sessions/${encodeURIComponent(id)}`);
}

export async function apiLogoutAllSessions(): Promise<void> {
  await request<void>('POST', '/auth/logout-all');
}

export async function apiPatchCurrentSessionDeviceLabel(
  body: PatchCurrentSessionDeviceLabelBody,
): Promise<void> {
  await request<void>('PATCH', '/auth/sessions/current/device-label', body);
}
