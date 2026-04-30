import {
  AdminSourcesResponseSchema,
  type AdminSourcesResponse,
  type AnnouncementCreateBody,
  type AnnouncementResponse,
  type AnnouncementUpdateBody,
} from '@nodea/shared';

import { request } from './internal.ts';

/* ----------------------------------------------------------------
 * Admin types
 * -------------------------------------------------------------- */

export interface AdminUserRow {
  id: string;
  email: string;
  username: string | null;
  role: 'user' | 'admin';
  onboardingStatus: 'pending' | 'complete';
  createdAt: string;
  updatedAt: string;
}

export interface AdminInviteRow {
  id: string;
  email: string;
  createdBy: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface AdminSettings {
  open_registration: boolean;
}

/* ----------------------------------------------------------------
 * Users + invites
 * -------------------------------------------------------------- */

export async function apiAdminListUsers(): Promise<AdminUserRow[]> {
  const { users } = await request<{ users: AdminUserRow[] }>('GET', '/admin/users');
  return users;
}

export async function apiAdminDeleteUser(userId: string): Promise<void> {
  await request<void>('DELETE', `/admin/users/${encodeURIComponent(userId)}`);
}

export async function apiAdminListInvites(): Promise<AdminInviteRow[]> {
  const { invites } = await request<{ invites: AdminInviteRow[] }>(
    'GET',
    '/admin/invites',
  );
  return invites;
}

/**
 * Send an invite by email (Bitwarden-style). Server generates the
 * token, hashes it, emails the link to the recipient. The clear
 * token never round-trips to the admin UI — there's nothing to
 * surface or copy here. The list endpoint shows status; the resend
 * endpoint re-mails.
 */
export async function apiAdminSendInvite(
  email: string,
  expiresAt?: string,
): Promise<{ id: string; email: string; expiresAt: string }> {
  return request<{ id: string; email: string; expiresAt: string }>(
    'POST',
    '/admin/invites',
    expiresAt ? { email, expiresAt } : { email },
  );
}

export async function apiAdminResendInvite(
  inviteId: string,
): Promise<{ id: string; email: string; expiresAt: string }> {
  return request<{ id: string; email: string; expiresAt: string }>(
    'POST',
    `/admin/invites/${encodeURIComponent(inviteId)}/resend`,
  );
}

export async function apiAdminDeleteInvite(inviteId: string): Promise<void> {
  await request<void>('DELETE', `/admin/invites/${encodeURIComponent(inviteId)}`);
}

/* ----------------------------------------------------------------
 * Sources health probe
 * -------------------------------------------------------------- */

/**
 * Probe every external metadata provider used by the modules and
 * return per-source health (configured / online / responseMs / etc.).
 * Triggers up to 5 outbound HTTP calls per request (the Library
 * providers); rate-limited at the route level. Used by the admin
 * "Sources" tab.
 */
export async function apiAdminSources(): Promise<AdminSourcesResponse> {
  const raw = await request<unknown>('GET', '/admin/sources');
  return AdminSourcesResponseSchema.parse(raw);
}

/* ----------------------------------------------------------------
 * App settings
 * -------------------------------------------------------------- */

export async function apiAdminGetSettings(): Promise<AdminSettings> {
  return request<AdminSettings>('GET', '/admin/settings');
}

export async function apiAdminPatchSettings(
  patch: Partial<AdminSettings>,
): Promise<AdminSettings> {
  return request<AdminSettings>('PATCH', '/admin/settings', patch);
}

/* ----------------------------------------------------------------
 * Announcements
 * -------------------------------------------------------------- */

export async function apiAdminListAnnouncements(): Promise<AnnouncementResponse[]> {
  const { announcements } = await request<{ announcements: AnnouncementResponse[] }>(
    'GET',
    '/admin/announcements',
  );
  return announcements;
}

export async function apiAdminCreateAnnouncement(
  body: AnnouncementCreateBody,
): Promise<AnnouncementResponse> {
  return request<AnnouncementResponse>('POST', '/admin/announcements', body);
}

export async function apiAdminUpdateAnnouncement(
  id: string,
  body: AnnouncementUpdateBody,
): Promise<AnnouncementResponse> {
  return request<AnnouncementResponse>(
    'PATCH',
    `/admin/announcements/${encodeURIComponent(id)}`,
    body,
  );
}

export async function apiAdminDeleteAnnouncement(id: string): Promise<void> {
  await request<void>(
    'DELETE',
    `/admin/announcements/${encodeURIComponent(id)}`,
  );
}
