import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth.ts';
import { authMfaRoutes } from './routes/auth-mfa.ts';
import { authMfaBypassRoutes } from './routes/auth-mfa-bypass.ts';
import { authPasskeyRoutes } from './routes/auth-passkey.ts';
import { authReauthRoutes } from './routes/auth-reauth.ts';
import { authRecoveryRoutes } from './routes/auth-recovery.ts';
import { authRegisterV2Routes } from './routes/auth-register-v2.ts';
import { authSecurityModeRoutes } from './routes/auth-security-mode.ts';
import { authTotpRoutes } from './routes/auth-totp.ts';
import { adminRoutes } from './routes/admin.ts';
import { announcementsRoutes } from './routes/announcements.ts';
import { modulesConfigRoutes } from './routes/modules-config.ts';
import { userPreferencesRoutes } from './routes/user-preferences.ts';
import { libraryLookupRoutes } from './routes/library-lookup.ts';
import { createCollectionRoutes } from './routes/collection-factory.ts';
import { COLLECTIONS } from './collections/registry.ts';
import { getConfig } from './config.ts';
import type { AuthVariables } from './middleware/require-user.ts';
import { redactingPrintFunc } from './middleware/sanitize-log-url.ts';

/** Build a fresh Hono app. Exported so tests can assemble an app without side-effects. */
export function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();

  // CORS for the dev web origin. In prod the web is served behind the
  // same origin as the API so CORS is a no-op. `credentials: true` is
  // required so the browser forwards the session cookie.
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return '';
        // Accept any localhost / 127.0.0.1 dev origin
        if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
        return '';
      },
      credentials: true,
      allowHeaders: ['content-type'],
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  // Hono's logger() prints `<method> <url> <status> <duration>`.
  // We hand it a sanitising printer so the HMAC `d=` guard
  // (passed as a query param by the collection factory) and any
  // `token=…` param never reach stdout. CLAUDE.md §Error handling
  // forbids logging crypto material — see `docs/security-audit.md`
  // Finding 1.
  app.use('*', logger(redactingPrintFunc));

  app.get('/healthz', (c) => c.json({ status: 'ok' }));

  // Public build identity. Lets ops, support and a future mobile client
  // tell which build is running on a given instance. No `version` semver
  // field — Nodea doesn't tag releases yet ; the commit SHA is the
  // unambiguous identifier (when tags arrive, add `version`).
  // No `api_version` either as long as API-10 (versioning strategy)
  // isn't figée.
  app.get('/version', (c) => {
    const cfg = getConfig();
    return c.json({
      commit: cfg.BUILD_COMMIT,
      build_date: cfg.BUILD_DATE,
      branch: cfg.BUILD_BRANCH,
    });
  });

  // Single-step register flow with magic-link activation
  // (Auth-Roadmap Phase 1 simplified). Mounted BEFORE the legacy
  // `authRoutes` so the more specific path catches everything under
  // `/auth/register/*` AND the bare `POST /auth/register` route. The
  // legacy single-shot register handler in `authRoutes` is no longer
  // reachable via HTTP — admin seeding uses direct DB inserts.
  app.route('/auth/register', authRegisterV2Routes);
  // Recovery-code KEK routes (Auth-Roadmap Phase 3) — mounted
  // BEFORE `authRoutes` so the recover-kek/* and security/recovery-
  // code paths catch first. The general /auth namespace is broad
  // and would otherwise win on the trie.
  app.route('/auth', authRecoveryRoutes);
  // Passkey routes (Auth-Roadmap Phase 4) — same ordering rationale:
  // mounted before the general `authRoutes` so /auth/passkey/* wins
  // the trie before any catch-alls in the legacy router.
  app.route('/auth', authPasskeyRoutes);
  // TOTP routes (Auth-Roadmap Phase 5B). Same ordering — mounted
  // before `authRoutes` so /auth/totp/* + /auth/mfa/totp/* hit the
  // dedicated handlers first.
  app.route('/auth', authTotpRoutes);
  // Stepped-MFA routes (Auth-Roadmap Phase 5C) — `/auth/mfa/*`
  // operates on `mfa_pending` sessions only. Mounted before the
  // catch-all `authRoutes` so the trie picks the dedicated handlers.
  app.route('/auth', authMfaRoutes);
  // MFA bypass routes (Auth-Roadmap Phase 6) — `/auth/mfa/bypass/*`
  // mixes mfa_pending (request), full-session (active / cancel),
  // and anonymous (email-link confirm/cancel) endpoints.
  app.route('/auth', authMfaBypassRoutes);
  // Re-auth routes (Auth-Roadmap Phase 7A) — `/auth/reauth/*`
  // bumps `reauth_*_at` on the current `full` session so subsequent
  // mutating actions can pass `requireFreshPassword` /
  // `requireFreshPasswordOrPasskey` for 5 minutes.
  app.route('/auth', authReauthRoutes);
  // Security-mode change (Auth-Roadmap Phase 5D). Same ordering —
  // dedicated handler before the legacy catch-all.
  app.route('/auth', authSecurityModeRoutes);
  app.route('/auth', authRoutes);
  app.route('/admin', adminRoutes);
  app.route('/announcements', announcementsRoutes);
  app.route('/modules-config', modulesConfigRoutes);
  app.route('/user-preferences', userPreferencesRoutes);
  app.route('/library/lookup', libraryLookupRoutes);

  // Every collection gets its 4 REST routes with requireUser + requireGuard
  // wired in by the factory. Adding a module = adding an entry in
  // `COLLECTIONS` in src/collections/registry.ts; the loop here is
  // intentionally boring — there is nowhere to forget a guard.
  for (const collection of COLLECTIONS) {
    app.route(`/${collection.name}`, createCollectionRoutes(collection.table));
  }

  app.onError((err, c) => {
    console.error('[api] unhandled error', err);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}

export type AppType = ReturnType<typeof buildApp>;
