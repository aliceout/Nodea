/**
 * Typed HTTP client for the new Nodea API — barrel re-export.
 *
 * Uses the shared Zod schemas in `@nodea/shared` so request/response
 * shapes stay in lock-step with the server. A thin wrapper over `fetch`
 * that:
 *   - sets credentials: "include" so the session cookie flows back
 *   - serialises JSON bodies
 *   - translates non-2xx to a typed `ApiError`
 *
 * Architecture: this file is a barrel. The actual implementations live
 * in per-domain modules to keep each file under the project's 200–300
 * LOC ceiling :
 *   - `internal.ts`        — `apiBase`, `request`, `safeJson`, `ApiError`
 *   - `auth.ts`            — register / login / re-auth / change-password
 *                            / change-email / reset / recovery / delete-me
 *   - `mfa.ts`             — stepped MFA verify + bypass request/confirm
 *   - `passkeys.ts`        — WebAuthn enrollment / list / login
 *   - `totp.ts`            — TOTP enroll / verify / disable / regen codes
 *   - `security-mode.ts`   — security_mode change
 *   - `library.ts`         — ISBN lookup + cover proxy + NDJSON stream
 *   - `admin.ts`           — users / invites / sources / settings /
 *                            announcements (admin-only routes)
 *   - `storage.ts`         — encrypted modules-config + user-preferences
 *
 * Consumers continue to import from `core/api/client.ts` to keep the
 * 38+ existing call sites stable.
 */
export type { ApiError } from './internal.ts';
export { isApiError } from './internal.ts';
export { apiErrorMessage } from './error-message.ts';

export {
  apiChangeEmail,
  apiChangePasswordFinish,
  apiChangePasswordStart,
  apiChangeUsername,
  apiCompleteOnboarding,
  apiDeleteMe,
  apiLoginFinish,
  apiLoginStart,
  apiLogout,
  apiMe,
  apiReauthPasskeyFinish,
  apiReauthPasskeyStart,
  apiReauthPasswordFinish,
  apiReauthPasswordStart,
  apiRecoverKekFinish,
  apiRecoverKekStart,
  apiRecoveryCodeUpsert,
  apiRegister,
  apiRegisterActivate,
  apiRegisterFinish,
  apiRegisterInviteInfo,
  apiRegisterMode,
  apiRegisterStart,
  apiRequestPasswordReset,
  apiResetPasswordFinish,
  apiResetPasswordStart,
} from './auth.ts';

export {
  apiMfaBypassConfirm,
  apiMfaBypassRequest,
  apiMfaPasskeyFinish,
  apiMfaPasskeyStart,
  apiMfaTotpVerify,
} from './mfa.ts';

export {
  apiPasskeyEnrollFinish,
  apiPasskeyEnrollStart,
  apiPasskeyList,
  apiPasskeyLoginFinish,
  apiPasskeyLoginStart,
  apiPasskeyRemove,
  apiPasskeyRename,
} from './passkeys.ts';

export {
  apiTotpDisable,
  apiTotpEnrollStart,
  apiTotpEnrollVerify,
  apiTotpRegenerateBackupCodes,
} from './totp.ts';

export { apiSecurityModeChange } from './security-mode.ts';

export {
  apiLibraryFetchCover,
  apiLibraryLookupByIsbn,
  streamLibraryLookupByQuery,
  type LibraryCoverFetchResult,
  type StreamLibraryLookupOptions,
} from './library.ts';

export {
  apiAdminCreateAnnouncement,
  apiAdminDeleteAnnouncement,
  apiAdminDeleteInvite,
  apiAdminDeleteUser,
  apiAdminGetSettings,
  apiAdminListAnnouncements,
  apiAdminListInvites,
  apiAdminListUsers,
  apiAdminPatchSettings,
  apiAdminResendInvite,
  apiAdminSendInvite,
  apiAdminSources,
  apiAdminUpdateAnnouncement,
  type AdminInviteRow,
  type AdminSettings,
  type AdminUserRow,
} from './admin.ts';

export {
  apiGetModulesConfig,
  apiGetUserPreferences,
  apiPutModulesConfig,
  apiPutUserPreferences,
  type ModulesConfigResponse,
  type UserPreferencesResponse,
} from './storage.ts';
