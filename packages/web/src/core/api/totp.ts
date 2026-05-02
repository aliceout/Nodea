import {
  TotpEnrollStartResponseSchema,
  TotpRegenerateBackupCodesResponseSchema,
  type TotpEnrollStartBody,
  type TotpEnrollStartResponse,
  type TotpEnrollVerifyBody,
  type TotpManagementBody,
  type TotpRegenerateBackupCodesResponse,
} from '@nodea/shared';

import { request } from './internal.ts';

/* ----------------------------------------------------------------
 * TOTP (Auth-Roadmap Phase 5B)
 * -------------------------------------------------------------- */

export async function apiTotpEnrollStart(
  body: TotpEnrollStartBody,
): Promise<TotpEnrollStartResponse> {
  return request(
    'POST',
    '/auth/totp/enroll/start',
    body,
    TotpEnrollStartResponseSchema,
  );
}

export async function apiTotpEnrollVerify(
  body: TotpEnrollVerifyBody,
): Promise<{ ok: true; enabledAt: string }> {
  return request<{ ok: true; enabledAt: string }>(
    'POST',
    '/auth/totp/enroll/verify',
    body,
  );
}

export async function apiTotpDisable(body: TotpManagementBody): Promise<void> {
  await request<void>('POST', '/auth/totp/disable', body);
}

export async function apiTotpRegenerateBackupCodes(
  body: TotpManagementBody,
): Promise<TotpRegenerateBackupCodesResponse> {
  return request(
    'POST',
    '/auth/totp/backup-codes/regenerate',
    body,
    TotpRegenerateBackupCodesResponseSchema,
  );
}
