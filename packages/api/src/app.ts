import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono, defaultInvalidBodyHook } from './openapi/index.ts';
import { requireAdmin, requireUser } from './middleware/require-user.ts';
import { authRoutes } from './routes/auth.ts';
import { authMfaRoutes } from './routes/auth-mfa.ts';
import { authMfaBypassRoutes } from './routes/auth-mfa-bypass.ts';
import { authPasskeyRoutes } from './routes/auth-passkey.ts';
import { authReauthRoutes } from './routes/auth-reauth.ts';
import { authSessionsRoutes } from './routes/auth-sessions.ts';
import { authRecoveryRoutes } from './routes/auth-recovery.ts';
import { authRegisterV2Routes } from './routes/auth-register-v2.ts';
import { authSecurityModeRoutes } from './routes/auth-security-mode.ts';
import { authTotpRoutes } from './routes/auth-totp.ts';
import { adminRoutes } from './routes/admin.ts';
import { announcementsRoutes } from './routes/announcements.ts';
import { modulesConfigRoutes } from './routes/modules-config.ts';
import { userPreferencesRoutes } from './routes/user-preferences.ts';
import { libraryLookupRoutes } from './routes/library-lookup.ts';
import { createRecordsRoutes } from './routes/records.ts';
import { COLLECTIONS } from './collections.ts';
import { getConfig } from './config.ts';
import { sql } from './db/client.ts';
import { errorWebhook } from './middleware/error-webhook.ts';
import { __resetRateLimits } from './middleware/rate-limit.ts';
import type { AuthVariables } from './middleware/require-user.ts';
import { redactingPrintFunc } from './middleware/sanitize-log-url.ts';

/** Build a fresh Hono app. Exported so tests can assemble an app without side-effects. */
export function buildApp() {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>({
    defaultHook: defaultInvalidBodyHook,
  });

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
  // We hand it a sanitising printer so :
  //   - Query strings on `/auth/*` and `/<module>/*` are nuked
  //     wholesale (no `?…` content reaches the log, regardless of
  //     param names — defends against a future param drift).
  //   - Outside those prefixes, a denylist of known-sensitive
  //     names (`token`, `t`, `code`, `email`, etc.) is scrubbed
  //     per-param.
  // See `middleware/sanitize-log-url.ts` for the strategy + issue
  // #71 for the broader opacity sweep.
  //
  // The module identifier itself was previously in the URL
  // (`/mood/records` vs `/library-items/records`) and would have
  // leaked to a proxy operator via the access log + sessions
  // table. Issue #67 collapsed every collection behind a single
  // `/records` endpoint with the module name carried in the
  // `X-Collection` header instead — neither Nginx's default
  // `access_log` nor Hono's `logger()` records custom headers.
  //
  // CLAUDE.md §Error handling forbids logging crypto material.
  app.use('*', logger(redactingPrintFunc));

  // Cache-Control on every API response (Tier 3 follow-up — the
  // « no proxy ever caches authenticated data » rule). Without it,
  // a corporate proxy or browser bfcache can serve one user's
  // /auth/me / /records to another user. `/healthz` and `/version`
  // are public and idempotent — they may be cached, so we leave
  // them alone.
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
      buildDate: cfg.BUILD_DATE,
      branch: cfg.BUILD_BRANCH,
    });
  });

  // Test-only escape hatch — Playwright's global-setup hits this so
  // a sequence of register/login attempts doesn't run into the
  // in-process rate-limit buckets that survive across runs (the dev
  // api process is reused via reuseExistingServer, so the buckets
  // never reset on their own). Guarded by NODE_ENV so prod cannot
  // hit it.
  if (getConfig().NODE_ENV !== 'production') {
    app.post('/__test__/reset-rate-limits', (c) => {
      __resetRateLimits();
      return c.json({ ok: true });
    });

    // Lookup a user.id by email — used by the e2e suite to assert
    // FK cascades after `DELETE /auth/me` (test 06) and to promote
    // the freshly-registered user to admin (test 12). The helper
    // queries the api's own DB rather than a separately-configured
    // postgres URL so a dev session reusing this api process via
    // `reuseExistingServer` always sees the same rows.
    app.get('/__test__/user-id', async (c) => {
      const email = c.req.query('email')?.toLowerCase();
      if (!email) return c.json({ id: null });
      const rows = await sql`
        SELECT id FROM users WHERE email = ${email} LIMIT 1
      `;
      const id = rows[0]?.['id'] ?? null;
      return c.json({ id });
    });

    app.post('/__test__/promote-admin', async (c) => {
      const body = await c.req.json<{ userId?: string }>();
      const userId = body.userId;
      if (!userId) return c.json({ ok: false, error: 'missing_user_id' }, 400);
      await sql`UPDATE users SET role = 'admin' WHERE id = ${userId}`;
      return c.json({ ok: true });
    });

    // Backdate confirmed_at on every active bypass request for a
    // user — used by test 10 to simulate the 7-day apply window
    // having elapsed without actually waiting a week. Same DB-
    // alignment rationale as the helpers above : going through
    // the api guarantees we hit whatever DB the api is bound to,
    // even when `reuseExistingServer` reuses a dev process whose
    // DATABASE_URL was pinned at startup.
    app.post('/__test__/backdate-bypass', async (c) => {
      const body = await c.req.json<{ userId?: string }>();
      const userId = body.userId;
      if (!userId) return c.json({ ok: false, error: 'missing_user_id' }, 400);
      try {
        const rows = await sql`
          UPDATE mfa_bypass_requests
          SET confirmed_at = NOW() - INTERVAL '8 days'
          WHERE user_id = ${userId}
            AND confirmed_at IS NOT NULL
            AND consumed_at IS NULL
            AND cancelled_at IS NULL
          RETURNING id
        `;
        return c.json({ ok: true, updated: rows.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return c.json({ ok: false, error: 'sql_error', detail: message }, 500);
      }
    });
  }

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
  // mounted before the general `authRoutes` so /auth/passkeys/* wins
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
  // Active-sessions UI (issue #47) — `/auth/sessions/*` +
  // `/auth/logout-all`. Mounted before `authRoutes` so the
  // `/sessions/:id` DELETE wins the trie over any future broad
  // catch-all in the legacy router.
  app.route('/auth', authSessionsRoutes);
  // Security-mode change (Auth-Roadmap Phase 5D). Same ordering —
  // dedicated handler before the legacy catch-all.
  app.route('/auth', authSecurityModeRoutes);
  app.route('/auth', authRoutes);
  app.route('/admin', adminRoutes);
  app.route('/announcements', announcementsRoutes);
  app.route('/modules-config', modulesConfigRoutes);
  app.route('/user-preferences', userPreferencesRoutes);
  app.route('/library/lookup', libraryLookupRoutes);

  // Single unified `/records` endpoint for every encrypted
  // collection (issue #67). The module identifier moves from the
  // URL into the `X-Collection` request header — Nginx and Hono's
  // default loggers don't record custom headers, so the activity
  // log no longer reveals which module a request touched.
  // Adding a module = adding an entry in `COLLECTIONS` ; the
  // factory mounts the same guard gauntlet for every collection so
  // it is impossible to forget the guard validation.
  app.route('/', createRecordsRoutes(COLLECTIONS));

  // OpenAPI spec + Swagger UI — both gated behind `requireAdmin` so
  // the surface stays an admin-only ops affordance. Note the URL is
  // `/api/docs` from the public side (Nginx strips the `/api` prefix
  // before reaching the Hono app), but inside the app the routes are
  // simply `/docs/openapi.json` and `/docs`. Same convention as every
  // other route — see `index.ts` for the prefix story.
  app.get('/docs/openapi.json', requireUser, requireAdmin, (c) => {
    const doc = app.getOpenAPIDocument({
      openapi: '3.1.0',
      info: {
        title: 'Nodea API',
        version: '1.0.0',
        description: 'Self-hosted E2E-encrypted journaling app.',
      },
      servers: [{ url: '/api' }],
    });
    return c.json(doc);
  });
  app.get(
    '/docs',
    requireUser,
    requireAdmin,
    swaggerUI({ url: '/api/docs/openapi.json' }),
  );

  app.onError((err, c) => {
    console.error('[api] unhandled error', err);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}

export type AppType = ReturnType<typeof buildApp>;
