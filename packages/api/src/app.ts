import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth.ts';
import { adminRoutes } from './routes/admin.ts';
import type { AuthVariables } from './middleware/require-user.ts';

/** Build a fresh Hono app. Exported so tests can assemble an app without side-effects. */
export function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.use('*', logger());

  app.get('/healthz', (c) => c.json({ status: 'ok' }));

  app.route('/auth', authRoutes);
  app.route('/admin', adminRoutes);

  app.onError((err, c) => {
    console.error('[api] unhandled error', err);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}

export type AppType = ReturnType<typeof buildApp>;
