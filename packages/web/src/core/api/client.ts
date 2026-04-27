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
  type ChangePasswordStartBody,
  type ChangePasswordStartResponse,
  type ChangePasswordFinishBody,
  type ChangeEmailBody,
  type ChangeUsernameBody,
  type DeleteSelfBody,
  type RequestResetBody,
  type ResetPasswordStartBody,
  type ResetPasswordStartResponse,
  type ResetPasswordFinishBody,
  type AnnouncementCreateBody,
  type AnnouncementUpdateBody,
  type AnnouncementResponse,
  type OpaqueRegisterStartBody,
  type OpaqueRegisterStartResponse,
  type OpaqueRegisterFinishBody,
  type OpaqueLoginStartBody,
  type OpaqueLoginStartResponse,
  type OpaqueLoginFinishBody,
  type OpaqueLoginFinishResponse,
  type MfaTotpVerifyBody,
  type MfaTotpVerifyResponse,
  type RecoveryCodeUpsertBody,
  type RecoverKekStartBody,
  type RecoverKekStartResponse,
  type RecoverKekFinishBody,
  type PasskeyEnrollStartBody,
  type PasskeyEnrollStartResponse,
  type PasskeyEnrollFinishBody,
  type PasskeyEnrollFinishResponse,
  type PasskeyListResponse,
  type PasskeyRenameWithProofBody,
  type PasskeyDeleteBody,
  type PasskeyLoginStartBody,
  type PasskeyLoginStartResponse,
  type PasskeyLoginFinishBody,
  type PasskeyLoginFinishResponse,
  type TotpEnrollStartBody,
  type TotpEnrollStartResponse,
  type TotpEnrollVerifyBody,
  type TotpManagementBody,
  type TotpRegenerateBackupCodesResponse,
} from '@nodea/shared';
import type {
  RegisterActivateBody,
  RegisterModeResponse,
  InviteInfoResponse,
} from '@nodea/shared/schemas/auth-register-v2';

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

// --- Register flow (Auth-Roadmap Phase 1, post-rework v2) ------------
// Two paths into a single submit endpoint:
//   - invited:  /register?invite=<token> → form has email pre-filled
//                (read-only) → submit with `inviteToken` → instant
//                activation (one email exchange total).
//   - open:     /register without a token → submit creates inactive
//                account → activation email → click → activated.

/**
 * The register flow on mount: tells the page whether the open-
 * registration toggle is on, so it can branch between "show form"
 * and "show invitation-only" panel.
 */
export async function apiRegisterMode(): Promise<RegisterModeResponse> {
  return request<RegisterModeResponse>('GET', '/auth/register/mode');
}

/**
 * Look up an invite token to get the email it was issued for. The
 * register page calls this after reading `?invite=<token>` from the
 * URL, then pre-fills (and locks) the email field. Returns null on
 * 404 (invalid / expired / consumed) so the UI can show a "lien
 * invalide" panel without try/catching everywhere.
 */
export async function apiRegisterInviteInfo(
  token: string,
): Promise<InviteInfoResponse | null> {
  try {
    return await request<InviteInfoResponse>(
      'GET',
      `/auth/register/invite-info?token=${encodeURIComponent(token)}`,
    );
  } catch (err) {
    if (isApiError(err) && err.status === 404) return null;
    throw err;
  }
}

/**
 * OPAQUE register step 1 — exchanges the client's
 * `registrationRequest` for the server's response blob plus a
 * fresh `userId` the client uses to compute AAD bindings.
 */
export async function apiRegisterStart(
  body: OpaqueRegisterStartBody,
): Promise<OpaqueRegisterStartResponse> {
  return request<OpaqueRegisterStartResponse>(
    'POST',
    '/auth/register/start',
    body,
  );
}

/**
 * OPAQUE register step 2 — ships the persisted `registrationRecord`
 * (envelope) plus the wrapped main key + KEK blobs. Server creates
 * the user + opaque_records row.
 */
export async function apiRegisterFinish(
  body: OpaqueRegisterFinishBody,
): Promise<{ ok: true; activated: boolean; email?: string }> {
  return request<{ ok: true; activated: boolean; email?: string }>(
    'POST',
    '/auth/register/finish',
    body,
  );
}

export async function apiRegisterActivate(
  body: RegisterActivateBody,
): Promise<{ ok: true; email: string }> {
  return request<{ ok: true; email: string }>(
    'POST',
    '/auth/register/activate',
    body,
  );
}

/**
 * OPAQUE login step 1 — exchanges the client's `startLoginRequest`
 * for the server's `loginResponse` blob plus a `loginToken` the
 * client must echo at /finish so the server can pick up its
 * intermediate state (single-use, 5-minute TTL).
 */
export async function apiLoginStart(
  body: OpaqueLoginStartBody,
): Promise<OpaqueLoginStartResponse> {
  return request<OpaqueLoginStartResponse>(
    'POST',
    '/auth/login/start',
    body,
  );
}

/**
 * OPAQUE login step 2 — sends the client's `finishLoginRequest`
 * (computed locally from the `loginResponse` + the password). On
 * success the server emits a session cookie; the body is a
 * discriminated union (Auth-Roadmap Phase 5C):
 *
 *   - `needsMfa: false` → session is `full`, client follows the
 *     normal post-login path (call `/auth/me`, etc.).
 *   - `needsMfa: true` → session is `mfa_pending`. The body inlines
 *     the wrap blobs the client needs to unwrap the KEK + main key
 *     locally (since `/auth/me` refuses pending sessions); the
 *     client must drive `/auth/mfa/totp/verify` next.
 */
export async function apiLoginFinish(
  body: OpaqueLoginFinishBody,
): Promise<OpaqueLoginFinishResponse> {
  return request<OpaqueLoginFinishResponse>(
    'POST',
    '/auth/login/finish',
    body,
  );
}

/* ============================================================================
 * Stepped MFA (Auth-Roadmap Phase 5C)
 * ========================================================================== */

/**
 * Submit a TOTP code (or backup code in the same field) against the
 * current `mfa_pending` session. On the response:
 *
 *   - `finalized: true` — the server promoted the session to `full`
 *     and swapped the cookie. Client should call `/auth/me` to load
 *     the public user shape and proceed.
 *   - `finalized: false` — at least one factor still missing
 *     (e.g. mode `maximum` may need a passkey-as-second-factor in
 *     Phase 5D). The `missing` array drives the next step.
 */
export async function apiMfaTotpVerify(
  body: MfaTotpVerifyBody,
): Promise<MfaTotpVerifyResponse> {
  return request<MfaTotpVerifyResponse>('POST', '/auth/mfa/totp/verify', body);
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

export async function apiChangePasswordStart(
  body: ChangePasswordStartBody,
): Promise<ChangePasswordStartResponse> {
  return request<ChangePasswordStartResponse>(
    'POST',
    '/auth/change-password/start',
    body,
  );
}

export async function apiChangePasswordFinish(
  body: ChangePasswordFinishBody,
): Promise<void> {
  await request<void>('POST', '/auth/change-password/finish', body);
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

/**
 * Recovery-code KEK setup / regenerate (Auth-Roadmap Phase 3).
 * Server gates on whether `recovery_code_hash IS NULL`:
 *   - first-time setup: just `requireUser`.
 *   - regenerate: also requires `proofLoginToken` +
 *     `proofFinishLoginRequest` from a fresh OPAQUE login start.
 */
export async function apiRecoveryCodeUpsert(
  body: RecoveryCodeUpsertBody,
): Promise<{ ok: true; regenerated: boolean }> {
  return request<{ ok: true; regenerated: boolean }>(
    'POST',
    '/auth/security/recovery-code',
    body,
  );
}

export async function apiRecoverKekStart(
  body: RecoverKekStartBody,
): Promise<RecoverKekStartResponse> {
  return request<RecoverKekStartResponse>(
    'POST',
    '/auth/recover-kek/start',
    body,
  );
}

export async function apiRecoverKekFinish(
  body: RecoverKekFinishBody,
): Promise<void> {
  await request<void>('POST', '/auth/recover-kek/finish', body);
}

export async function apiResetPasswordStart(
  body: ResetPasswordStartBody,
): Promise<ResetPasswordStartResponse> {
  return request<ResetPasswordStartResponse>(
    'POST',
    '/auth/reset/start',
    body,
  );
}

export async function apiResetPasswordFinish(
  body: ResetPasswordFinishBody,
): Promise<void> {
  await request<void>('POST', '/auth/reset/finish', body);
}

export async function apiDeleteMe(body: DeleteSelfBody): Promise<void> {
  await request<void>('DELETE', '/auth/me', body);
}

/* ============================================================================
 * Passkey / WebAuthn (Auth-Roadmap Phase 4)
 * ========================================================================== */

/** Start enrollment — exchanges the OPAQUE password proof for the
 *  WebAuthn `creationOptions` to feed into `startRegistration`. */
export async function apiPasskeyEnrollStart(
  body: PasskeyEnrollStartBody,
): Promise<PasskeyEnrollStartResponse> {
  return request<PasskeyEnrollStartResponse>(
    'POST',
    '/auth/passkey/enroll/start',
    body,
  );
}

/** Finish enrollment — sends the attestation response + the wrapped
 *  KEK (when PRF-capable) so the server can persist the credential. */
export async function apiPasskeyEnrollFinish(
  body: PasskeyEnrollFinishBody,
): Promise<PasskeyEnrollFinishResponse> {
  return request<PasskeyEnrollFinishResponse>(
    'POST',
    '/auth/passkey/enroll/finish',
    body,
  );
}

export async function apiPasskeyList(): Promise<PasskeyListResponse> {
  return request<PasskeyListResponse>('GET', '/auth/passkey/list');
}

export async function apiPasskeyRename(
  id: string,
  body: PasskeyRenameWithProofBody,
): Promise<void> {
  await request<void>('PATCH', `/auth/passkey/${id}/label`, body);
}

export async function apiPasskeyRemove(
  id: string,
  body: PasskeyDeleteBody,
): Promise<void> {
  await request<void>('POST', `/auth/passkey/${id}/remove`, body);
}

/** Anonymous: request WebAuthn `requestOptions` for a passkey login.
 *  Server returns generic options (no `allowCredentials`) when `email`
 *  is absent or unknown — anti-enum + supports discoverable creds. */
export async function apiPasskeyLoginStart(
  body: PasskeyLoginStartBody,
): Promise<PasskeyLoginStartResponse> {
  return request<PasskeyLoginStartResponse>(
    'POST',
    '/auth/passkey/login/start',
    body,
  );
}

/** Anonymous: ship the assertion and receive the wrap blobs the
 *  client needs to unwrap the KEK + main key. */
export async function apiPasskeyLoginFinish(
  body: PasskeyLoginFinishBody,
): Promise<PasskeyLoginFinishResponse> {
  return request<PasskeyLoginFinishResponse>(
    'POST',
    '/auth/passkey/login/finish',
    body,
  );
}

/* ============================================================================
 * TOTP (Auth-Roadmap Phase 5B)
 * ========================================================================== */

export async function apiTotpEnrollStart(
  body: TotpEnrollStartBody,
): Promise<TotpEnrollStartResponse> {
  return request<TotpEnrollStartResponse>('POST', '/auth/totp/enroll/start', body);
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
  return request<TotpRegenerateBackupCodesResponse>(
    'POST',
    '/auth/totp/backup-codes/regenerate',
    body,
  );
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
  email: string;
  createdBy: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface AdminSettings {
  open_registration: boolean;
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

// --- Admin app settings ------------------------------------------------

export async function apiAdminGetSettings(): Promise<AdminSettings> {
  return request<AdminSettings>('GET', '/admin/settings');
}

export async function apiAdminPatchSettings(
  patch: Partial<AdminSettings>,
): Promise<AdminSettings> {
  return request<AdminSettings>('PATCH', '/admin/settings', patch);
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
