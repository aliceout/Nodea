// Sentry must initialise BEFORE the rest of the app imports —
// the SDK instruments `http`, `fs`, etc. at require time. Putting
// `await initSentryApi()` first keeps that contract honoured.
// Now async because the SDK is dynamically `import()`'d only when
// `SENTRY_DSN` is set (see `sentry.ts` for the rationale). When
// the DSN is unset, this resolves immediately without ever
// touching `@sentry/node`.
import { initSentryApi } from './sentry.ts';
await initSentryApi();

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
  // Stop accepting connections and WAIT for in-flight requests to
  // drain before exiting. `server.close` is non-blocking and only
  // invokes its callback once every connection has ended, so it must
  // be awaited — a slow library lookup can take 20-30s, and the old
  // fire-and-forget close let `process.exit(0)` cut them off on every
  // redeploy. A 30s hard cap guards against a stuck keep-alive
  // connection blocking shutdown forever (the orchestrator SIGKILLs
  // past its grace period anyway).
  await new Promise<void>((resolve) => {
    const forced = setTimeout(resolve, 30_000);
    server.close(() => {
      clearTimeout(forced);
      // eslint-disable-next-line no-console
      console.log('[api] http server closed');
      resolve();
    });
  });
  await closeHeadlessBrowser();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export type { AppType } from './app.ts';
