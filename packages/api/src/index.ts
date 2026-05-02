// Sentry must initialise BEFORE the rest of the app imports —
// the SDK instruments `http`, `fs`, etc. at require time. Putting
// `initSentryApi()` first keeps that contract honoured. No-op when
// SENTRY_DSN is unset.
import { initSentryApi } from './sentry.ts';
initSentryApi();

import { serve } from '@hono/node-server';
import { buildApp } from './app.ts';
import { getConfig } from './config.ts';
import { startCronScheduler } from './cron.ts';
import { closeHeadlessBrowser } from './services/library-lookup/headless.ts';

const { PORT } = getConfig();
const app = buildApp();
startCronScheduler();

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://127.0.0.1:${info.port}`);
});

/**
 * Graceful shutdown: stop accepting new connections, close the
 * HTTP server, and tear down the headless Chromium that the
 * Amazon adapter keeps alive between lookups. Without this the
 * browser process becomes a zombie when the parent exits — the
 * OS reaps it eventually but we leave a window where Chromium
 * is still holding the cache directory open.
 */
async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[api] received ${signal}, shutting down…`);
  // Stop accepting connections; in-flight requests get to finish.
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log('[api] http server closed');
  });
  await closeHeadlessBrowser();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export type { AppType } from './app.ts';
