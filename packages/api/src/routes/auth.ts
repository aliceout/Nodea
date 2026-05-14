import { makeAuthedRouter } from '../openapi/index.ts';

import { authAccountRoutes } from './auth-account.ts';
import { authChangePasswordRoutes } from './auth-change-password.ts';
import { authLoginRoutes } from './auth-login.ts';
import { authResetRoutes } from './auth-reset.ts';

/**
 * Aggregate `authRoutes` — re-exports the four sub-routers
 * mounted on the same `/auth` prefix in `app.ts`. The
 * monolith file this used to be (3267 → 0 LOC of
 * orchestration) was split into :
 *
 *   - `auth-login.ts` — `/login/start`, `/login/finish`,
 *     `/logout`, including the OPAQUE handshake + the stepped
 *     MFA gate + the `applyConsumableBypass` chain.
 *   - `auth-reset.ts` — `/request-reset`, `/reset/start`,
 *     `/reset/finish`. The destructive purge of `modulesConfig`
 *     + `userPreferences` lives here.
 *   - `auth-change-password.ts` — `/change-password/start` +
 *     `/finish`. Two-step OPAQUE registration with a
 *     single-use token, gated behind the
 *     `requireFreshPasswordOrPasskey` middleware (the one
 *     entry where a passkey can substitute the password
 *     proof).
 *   - `auth-account.ts` — `GET /me` + `PATCH /email`,
 *     `PATCH /username`, `POST /onboarding/complete`,
 *     `DELETE /me`.
 *
 * Rate limiters and `isUniqueViolation` live in
 * `auth-shared.ts`. Other already-split routers in this
 * directory : `auth-totp.ts`, `auth-mfa.ts`, `auth-passkey.ts`,
 * `auth-recovery.ts`, `auth-reauth.ts`, `auth-mfa-bypass.ts`,
 * `auth-register-v2.ts`, `auth-security-mode.ts`.
 *
 * The export below stays as `authRoutes` for back-compat with
 * `app.ts`'s mount ; under the hood it's a thin OpenAPIHono
 * app that mounts each sub-router at the same root so the
 * external surface (`POST /auth/login/start` etc.) is
 * unchanged AND the OpenAPI doc aggregates routes from every
 * sub-router.
 */
export const authRoutes = makeAuthedRouter();

authRoutes.route('/', authLoginRoutes);
authRoutes.route('/', authResetRoutes);
authRoutes.route('/', authChangePasswordRoutes);
authRoutes.route('/', authAccountRoutes);
