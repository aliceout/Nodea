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
import { COLLECTIONS } from './collections.ts';
import { getConfig } from './config.ts';
import { sql } from './db/client.ts';
import { errorWebhook } from './middleware/error-webhook.ts';
import type { AuthVariables } from './middleware/require-user.ts';
import { redactingPrintFunc } from './middleware/sanitize-log-url.ts';

/** Build a fresh Hono app. Exported so tests can assemble an app without side-effects. */
export function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();

  // CORS for the dev web origin. In prod the web is served behind the
  // same origin as the API so CORS is a no-op — we explicitly refuse
  // every cross-origin request to close a residual attack surface
  // (e.g. a malicious app running on the user's localhost would
  // otherwise get credentialed CORS access). `credentials: true` is
  // required in dev so the browser forwards the session cookie when
  // Vite (port 8089) hits the api (port 3000).
  const isProd = getConfig().NODE_ENV === 'production';
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return '';
        if (isProd) return ''; // Same-origin only in prod, no exception.
        // Dev only: accept any localhost / 127.0.0.1 origin so Vite
        // on a non-default port still works.
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

  // Cache-Control on every API response (Tier 3 follow-up — the
  // « no proxy ever caches authenticated data » rule). Without it,
  // a corporate proxy or browser bfcache can serve one user's
  // /auth/me / /<module>/records to another user. `/healthz` and
  // `/version` are public and idempotent — they may be cached, so
  // we leave them alone.
  app.use('*', async (c, next) => {
    await next();
    const path = c.req.path;
    if (path === '/healthz' || path === '/version') return;
    c.header('Cache-Control', 'no-store, must-revalidate');
    c.header('Pragma', 'no-cache');
  });

  // Fire-and-forget webhook on every 5xx response (Tier 1 étape C
  // pas 1, OPS-02). Sends method + path + status + duration only,
  // no request data — see middleware/error-webhook.ts for the
  // privacy contract. No-op when ERROR_WEBHOOK_URL is unset.
  app.use('*', errorWebhook(getConfig().ERROR_WEBHOOK_URL));

  // Honest healthcheck — actually probes Postgres before returning OK.
  // Without this round-trip, `/healthz` would lie : the api process can
  // be alive while Postgres is dead (network split, restart in
  // progress, disk full), and an external monitor (UptimeRobot, Docker
  // healthcheck) would never fire. The probe is a tiny `SELECT 1` with
  // a hard 1500 ms ceiling so a slow DB never holds the request open
  // long enough to be itself a problem ; on miss we surface a 503 with
  // a snake_case reason so monitoring dashboards can distinguish a DB
  // outage from a cold start or a genuine 5xx.
  app.get('/healthz', async (c) => {
    try {
      const probe = sql`SELECT 1`;
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('db_probe_timeout')), 1500),
      );
      await Promise.race([probe, timeout]);
      return c.json({ status: 'ok' });
    } catch {
      return c.json({ status: 'degraded', error: 'db_unreachable' }, 503);
    }
  });

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
  // (Auth-Roadmap Phase 1 simplified). Mount-order doesn't matter
  // anymore — the legacy register handler in `authRoutes` was removed
  // when `auth.ts` was reduced to a thin barrel re-exporting the four
  // sub-routers (login / reset / change-password / account). API-16
  // audit confirmed `authRoutes` carries no dead routes today.
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
