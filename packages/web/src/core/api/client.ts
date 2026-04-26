/**
 * Typed HTTP client for the new Nodea API.
 *
 * Uses the shared Zod schemas in `@nodea/shared` so request/response
 * shapes stay in lock-step with the server. A thin wrapper over `fetch`
 * that:
 *   - sets credentials: "include" so the session cookie flows back
 *   - serialises JSON bodies
 *   - translates non-2xx to a typed `ApiError`
 *
 * Note: we deliberately do not use `hono/client`'s `hc<AppType>` inference
 * here. The Hono app is assembled via `app.route(...)` mounts which
 * break through-typing without refactor; doing that refactor is not in
 * Phase 5's scope. Shared Zod schemas give us the same guarantees at
 * the payload level.
 */
import {
  AdminSourcesResponseSchema,
  AuthMeResponseSchema,
  LibraryLookupResponseSchema,
  LibraryLookupStreamSnapshotSchema,
  type AdminSourcesResponse,
  type AuthMeResponse,
  type LibraryLookupByIsbnBody,
  type LibraryLookupByQueryBody,
  type LibraryLookupResponse,
  type LibraryLookupStreamSnapshot,
  type LoginBody,
  type RegisterBody,
  type ChangePasswordBody,
  type ChangeEmailBody,
  type ChangeUsernameBody,
  type DeleteSelfBody,
  type RequestResetBody,
  type ResetPasswordBody,
  type AnnouncementCreateBody,
  type AnnouncementUpdateBody,
  type AnnouncementResponse,
} from '@nodea/shared';

/**
 * Base URL for the API. Defaults to the same-origin `/api` prefix so
 * cookies flow without any cross-origin dance:
 *   - dev : the Vite proxy (see `packages/web/vite.config.js`) routes
 *     `/api/*` to the Hono dev server on :3000.
 *   - prod: nginx reverse-proxies `/api/*` to the api container.
 * Override via `VITE_API_URL` if you really need to hit a different
 * origin — but beware `SameSite=Lax` will reject the session cookie.
 * Resolved per call so tests can stub `import.meta.env`.
 */
function apiBase(): string {
  return (
    (import.meta.env as Record<string, string | undefined>).VITE_API_URL ?? '/api'
  );
}

export interface ApiError {
  status: number;
  error: string;
  reason?: string;
}

async function request<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  path: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const res = await fetch(`${apiBase()}${path}`, init);
  const text = await res.text();
  const payload: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      error:
        isRecord(payload) && typeof payload.error === 'string'
          ? payload.error
          : res.statusText,
    };
    if (isRecord(payload) && typeof payload.reason === 'string') {
      err.reason = payload.reason;
    }
    throw err;
  }
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// --- Auth endpoints ----------------------------------------------------

export async function apiRegister(body: RegisterBody): Promise<{ id: string }> {
  return request<{ id: string }>('POST', '/auth/register', body);
}

export async function apiLogin(body: LoginBody): Promise<{ id: string }> {
  return request<{ id: string }>('POST', '/auth/login', body);
}

export async function apiLogout(): Promise<void> {
  await request<void>('POST', '/auth/logout');
}

export async function apiMe(): Promise<AuthMeResponse | null> {
  try {
    const raw = await request<unknown>('GET', '/auth/me');
    return AuthMeResponseSchema.parse(raw);
  } catch (err) {
    if (isApiError(err) && err.status === 401) return null;
    throw err;
  }
}

export async function apiChangePassword(body: ChangePasswordBody): Promise<void> {
  await request<void>('POST', '/auth/change-password', body);
}

export async function apiChangeEmail(body: ChangeEmailBody): Promise<void> {
  await request<void>('PATCH', '/auth/email', body);
}

export async function apiChangeUsername(body: ChangeUsernameBody): Promise<void> {
  await request<void>('PATCH', '/auth/username', body);
}

export async function apiCompleteOnboarding(): Promise<void> {
  await request<void>('POST', '/auth/onboarding/complete');
}

export async function apiRequestPasswordReset(body: RequestResetBody): Promise<void> {
  await request<void>('POST', '/auth/request-reset', body);
}

export async function apiResetPassword(body: ResetPasswordBody): Promise<void> {
  await request<void>('POST', '/auth/reset', body);
}

export async function apiDeleteMe(body: DeleteSelfBody): Promise<void> {
  await request<void>('DELETE', '/auth/me', body);
}

// --- Library lookup (proxy) -------------------------------------------

export async function apiLibraryLookupByIsbn(
  body: LibraryLookupByIsbnBody,
): Promise<LibraryLookupResponse> {
  const raw = await request<unknown>('POST', '/library/lookup/by-isbn', body);
  return LibraryLookupResponseSchema.parse(raw);
}

export interface LibraryCoverFetchResult {
  mime: string;
  /** Base64 (no `data:` prefix) of the raw image bytes. */
  blob_b64: string;
}

/**
 * Fetch a cover image via the server-side proxy. Browsers can't
 * directly `fetch().arrayBuffer()` cover URLs because OL / Google
 * Books / Amazon don't expose CORS for arbitrary fetches (only
 * `<img>` tag loading). The proxy validates the URL against an
 * allowlist of provider hosts, downloads the bytes server-side,
 * and hands them back as `{ mime, blob_b64 }`.
 *
 * Returns `null` on any failure (provider 404, host not allowed,
 * timeout, oversized, network error). The caller treats a missing
 * cover as non-fatal — the book still gets saved.
 */
export async function apiLibraryFetchCover(
  url: string,
): Promise<LibraryCoverFetchResult | null> {
  try {
    const raw = await request<unknown>(
      'GET',
      `/library/lookup/cover-fetch?url=${encodeURIComponent(url)}`,
    );
    if (
      isRecord(raw) &&
      typeof raw.mime === 'string' &&
      typeof raw.blob_b64 === 'string'
    ) {
      return { mime: raw.mime, blob_b64: raw.blob_b64 };
    }
    return null;
  } catch {
    // Cover failures are non-blocking: we never want a broken
    // provider URL to stop the user from saving their book.
    return null;
  }
}

export interface StreamLibraryLookupOptions {
  /** Called for every NDJSON snapshot the server emits, including the
   * final one (where `done === true`). The list contains the *current*
   * accumulated, deduped, language-filtered results — the consumer
   * should replace its render list, not append. */
  onSnapshot: (snapshot: LibraryLookupStreamSnapshot) => void;
  /** Allows the caller to abort an in-flight stream — typically when
   * the user kicks off a fresh search before the previous one
   * finished. The fetch is cancelled, the reader stops. */
  signal?: AbortSignal;
}

/**
 * Free-text library lookup via the NDJSON streaming endpoint.
 * Opens an NDJSON connection and invokes `onSnapshot` for every
 * line the server emits.
 *
 * Implementation notes:
 *   - Uses `fetch` + `ReadableStream` (no EventSource — that would
 *     force GET, and we want POST with a JSON body).
 *   - Lines are split on `\n`; partial trailing data is buffered
 *     across reads. Empty lines are tolerated.
 *   - Each line is `JSON.parse`d and validated with the shared Zod
 *     schema; malformed lines are skipped with a console warning so
 *     a single bad chunk doesn't kill the whole stream.
 *   - Resolves when the stream ends (server signalled `done` and
 *     closed). Rejects with an `ApiError` on non-2xx response, or
 *     with the underlying error on network failure / abort.
 */
export async function streamLibraryLookupByQuery(
  body: LibraryLookupByQueryBody,
  opts: StreamLibraryLookupOptions,
): Promise<void> {
  const init: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
  // Only attach `signal` when present — `exactOptionalPropertyTypes`
  // forbids `signal: undefined` against the DOM's `signal: AbortSignal | null` shape.
  if (opts.signal) init.signal = opts.signal;
  const res = await fetch(`${apiBase()}/library/lookup/by-query/stream`, init);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const payload: unknown = text ? safeJson(text) : null;
    const err: ApiError = {
      status: res.status,
      error:
        isRecord(payload) && typeof payload.error === 'string'
          ? payload.error
          : res.statusText,
    };
    throw err;
  }

  if (!res.body) {
    throw new Error('streamLibraryLookupByQuery: no response body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) {
          try {
            const parsed = LibraryLookupStreamSnapshotSchema.parse(JSON.parse(line));
            opts.onSnapshot(parsed);
          } catch (parseErr) {
            console.warn('streamLibraryLookupByQuery: skipping bad chunk', parseErr);
          }
        }
        nl = buffer.indexOf('\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// --- Admin endpoints ---------------------------------------------------

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
  createdBy: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export async function apiAdminListUsers(): Promise<AdminUserRow[]> {
  const { users } = await request<{ users: AdminUserRow[] }>('GET', '/admin/users');
  return users;
}

export async function apiAdminDeleteUser(userId: string): Promise<void> {
  await request<void>('DELETE', `/admin/users/${encodeURIComponent(userId)}`);
}

export async function apiAdminListInvites(): Promise<AdminInviteRow[]> {
  const { invites } = await request<{ invites: AdminInviteRow[] }>('GET', '/admin/invites');
  return invites;
}

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

export async function apiAdminCreateInvite(expiresAt?: string): Promise<{ id: string; code: string }> {
  return request<{ id: string; code: string }>(
    'POST',
    '/admin/invites',
    expiresAt ? { expiresAt } : {},
  );
}

export async function apiAdminDeleteInvite(inviteId: string): Promise<void> {
  await request<void>('DELETE', `/admin/invites/${encodeURIComponent(inviteId)}`);
}

// --- Announcements endpoints -------------------------------------------

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
  await request<void>('DELETE', `/admin/announcements/${encodeURIComponent(id)}`);
}

// --- Modules config endpoints ------------------------------------------

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

// --- User preferences endpoints ----------------------------------------

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

// --- Error helpers -----------------------------------------------------

export function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && typeof value.status === 'number' && typeof value.error === 'string';
}
