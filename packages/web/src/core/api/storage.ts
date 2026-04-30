import { request } from './internal.ts';

/* ----------------------------------------------------------------
 * Modules config — encrypted blob keyed on user_id.
 * -------------------------------------------------------------- */

export interface ModulesConfigResponse {
  cipher_iv: string | null;
  payload: string | null;
  updated_at?: string;
}

export async function apiGetModulesConfig(): Promise<ModulesConfigResponse> {
  return request<ModulesConfigResponse>('GET', '/modules-config');
}

export async function apiPutModulesConfig(body: {
  cipher_iv: string;
  payload: string;
}): Promise<ModulesConfigResponse> {
  return request<ModulesConfigResponse>('PUT', '/modules-config', body);
}

/* ----------------------------------------------------------------
 * User preferences — encrypted blob keyed on user_id, separate row.
 * -------------------------------------------------------------- */

export interface UserPreferencesResponse {
  cipher_iv: string | null;
  payload: string | null;
  updated_at?: string;
}

export async function apiGetUserPreferences(): Promise<UserPreferencesResponse> {
  return request<UserPreferencesResponse>('GET', '/user-preferences');
}

export async function apiPutUserPreferences(body: {
  cipher_iv: string;
  payload: string;
}): Promise<UserPreferencesResponse> {
  return request<UserPreferencesResponse>('PUT', '/user-preferences', body);
}
