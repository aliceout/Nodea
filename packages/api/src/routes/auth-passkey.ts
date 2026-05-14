import { makeAuthedRouter } from '../openapi/index.ts';

import { authPasskeyEnrollRoutes } from './auth-passkey-enroll.ts';
import { authPasskeyLoginRoutes } from './auth-passkey-login.ts';
import { authPasskeyManageRoutes } from './auth-passkey-manage.ts';

/**
 * Passkey routes (Auth-Roadmap Phase 4, Auth-Spec §7.3 + §9).
 *
 * Five authenticated routes (`requireUser`) for enrollment /
 * list / rename / remove, plus two anonymous routes for the
 * passkey-first login flow :
 *
 *   - `POST /auth/passkeys/enroll/start`   (auth, password proof)
 *   - `POST /auth/passkeys/enroll/finish`  (auth)
 *   - `GET  /auth/passkeys/list`           (auth)
 *   - `PATCH /auth/passkeys/:id/label`     (auth, password proof)
 *   - `POST /auth/passkeys/:id/remove`     (auth, password proof)
 *   - `POST /auth/passkeys/login/start`    (anon)
 *   - `POST /auth/passkeys/login/finish`   (anon)
 *
 * Server-side WebAuthn primitives come from
 * `@simplewebauthn/server`. Challenges are persisted on the
 * `sessions` row for enrollment (`pending_webauthn_challenge`,
 * TTL 5 min) and on a single-use pending entry for login
 * (`passkey-login-state.ts`).
 *
 * UV is `'required'` everywhere — Auth-Spec §9.3 prescribes
 * refusing any authenticator without gesture (no PIN, no
 * biometric). The browser refuses non-UV authenticators at
 * enrollment ; the server also enforces
 * `userVerified === true` at /finish so a tampered client
 * can't bypass.
 *
 * Architecture : the 800-LOC monolith was split into three
 * sub-routers + a helpers module ; the aggregate
 * `authPasskeyRoutes` below mounts each at `/` so the
 * external surface (`POST /auth/passkeys/enroll/start` etc.)
 * stays unchanged.
 *   - `auth-passkey-enroll.ts` — start + finish (with the
 *     `auth_factors_credential_id_unique` collision handling).
 *   - `auth-passkey-manage.ts` — list + rename + remove
 *     (with the §6.1 mode-max downgrade auto on last PRF
 *     passkey deletion).
 *   - `auth-passkey-login.ts` — login start + finish (with
 *     the stepped-MFA gate + `applyConsumableBypass` chain,
 *     mirror of `auth-login.ts`).
 *   - `passkey-helpers.ts` — `userIdToHandle`,
 *     `bytesToBase64Url`, `base64UrlToBytes`,
 *     `parseTransports`, the three rate limiters, the
 *     `AuthenticationExtensionsClientInputsLike` type
 *     widener.
 *
 * `isUniqueViolation` lives in `auth-shared.ts` (was
 * duplicated locally before the dedup).
 */
export const authPasskeyRoutes = makeAuthedRouter();

authPasskeyRoutes.route('/', authPasskeyEnrollRoutes);
authPasskeyRoutes.route('/', authPasskeyManageRoutes);
authPasskeyRoutes.route('/', authPasskeyLoginRoutes);
