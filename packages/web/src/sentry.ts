/**
 * Sentry SDK init for the web bundle.
 *
 * Tier 1 étape C pas 2 (OPS-02). Captures unhandled errors that
 * happen in the browser — React render errors that bubble past
 * the per-module ErrorBoundary, unhandled promise rejections,
 * and `console.error` calls.
 *
 * **No-op when DSN is unset.** Call `initSentryWeb()`
 * unconditionally ; if `VITE_SENTRY_DSN` is empty (the dev
 * default), the function returns immediately without ever
 * loading the Sentry SDK. The dynamic `import('@sentry/react')`
 * inside the if-DSN branch lets Vite tree-shake / code-split the
 * SDK into a separate chunk that is only fetched + parsed by
 * browsers running a DSN-configured build (audit v2.8.0, perf).
 * Operators who don't want Nodea to phone home keep
 * `VITE_SENTRY_DSN` empty in `.env` ; the chunk never leaves the
 * server in that case (Vite only emits chunks that have at least
 * one reachable import at build time, which is the case here, but
 * the browser never asks for it).
 *
 * **`beforeSend` privacy contract.** Same posture as the api
 * (`packages/api/src/sentry.ts`) :
 *   - Cookies stripped from any request data Sentry attaches.
 *   - Headers `x-sid`, `x-guard`, `cookie`, `authorization` stripped.
 *   - Query strings stripped.
 *   - Request body stripped.
 *   - User context fields (`email`, `username`, `ip_address`) stripped.
 *
 * **No BrowserTracing, no Replay.** The default integrations would
 * ship navigations, clicks, and DOM snapshots to Sentry as
 * breadcrumbs / replays. That bypasses the `/flow` privacy
 * invariant — module-visited metadata would leak through Sentry's
 * pipeline. We filter them out at init time so they can never
 * be silently re-enabled by a stale config.
 *
 * **Privacy tradeoff acknowledged.** Stack traces are still
 * shipped to Sentry's cloud, and a stack trace can leak which
 * module a user has enabled (an exception in `Mood/context.tsx`
 * tells Sentry "this user uses Mood"). Operators of Nodea who
 * care strictly about that should keep `VITE_SENTRY_DSN` unset.
 */
const HEADER_BLACKLIST = new Set([
  'cookie',
  'authorization',
  'x-sid',
  'x-guard',
]);

export async function initSentryWeb(): Promise<void> {
  const env = import.meta.env as Record<string, string | undefined>;
  const dsn = env.VITE_SENTRY_DSN;
  if (!dsn) return;

  // Dynamic import — Vite code-splits @sentry/react into a separate
  // chunk that's only fetched by browsers running a DSN-configured
  // build. ~80 KB saved on the main bundle when DSN is unset.
  const Sentry = await import('@sentry/react');

  Sentry.init({
    dsn,
    environment: env.MODE ?? 'production',
    // Errors only — no perf monitoring, no replay. If those become
    // a need later, set `tracesSampleRate` / `replaysSessionSampleRate`
    // per-environment.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // Filter out integrations that would leak module-visited
    // metadata to Sentry through breadcrumbs / replays.
    integrations: (defaults) =>
      defaults.filter(
        (i) => i.name !== 'BrowserTracing' && i.name !== 'Replay',
      ),
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.query_string;
        event.request.data = undefined;
        if (event.request.headers && typeof event.request.headers === 'object') {
          const headers = event.request.headers as Record<string, unknown>;
          for (const key of Object.keys(headers)) {
            if (HEADER_BLACKLIST.has(key.toLowerCase())) {
              delete headers[key];
            }
          }
        }
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}
