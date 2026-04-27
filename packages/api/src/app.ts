import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth.ts';
import { authRecoveryRoutes } from './routes/auth-recovery.ts';
import { authRegisterV2Routes } from './routes/auth-register-v2.ts';
import { adminRoutes } from './routes/admin.ts';
import { announcementsRoutes } from './routes/announcements.ts';
import { modulesConfigRoutes } from './routes/modules-config.ts';
import { userPreferencesRoutes } from './routes/user-preferences.ts';
import { libraryLookupRoutes } from './routes/library-lookup.ts';
import { createCollectionRoutes } from './routes/collection-factory.ts';
import { COLLECTIONS } from './collections/registry.ts';
import type { AuthVariables } from './middleware/require-user.ts';

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

  app.use('*', logger());

  app.get('/healthz', (c) => c.json({ status: 'ok' }));

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
