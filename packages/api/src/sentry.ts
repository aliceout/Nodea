/**
 * Sentry SDK init for the api process.
 *
 * Tier 1 étape C pas 2 (OPS-02). Plugs on top of pas 1 (5xx
 * webhook) — Sentry gives detailed stack traces + grouping +
 * triage UI ; the webhook stays as the cheap, dep-free signal
 * that never disappears even if Sentry quota runs out, the
 * network to Sentry's cloud is degraded, or someone unsets
 * `SENTRY_DSN`.
 *
 * **Why this file exists separately from `app.ts`.** Sentry's
 * docs require `Sentry.init()` to run **before** the rest of the
 * app boots — instrumenting modules at import time. The cleanest
 * way to honour that is a top-level call in `index.ts` that runs
 * before `buildApp()`. This file exposes `initSentryApi()` so
 * `index.ts` stays readable.
 *
 * **Lazy-loaded by design.** The whole `@sentry/node` module
 * (and its transitive `@fastify/otel` instrumentation chain) is
 * pulled in via a dynamic `import()` inside `initSentryApi()`,
 * gated on a non-empty `SENTRY_DSN`. When the operator hasn't
 * opted into Sentry (the dev default, and the « privacy-first »
 * self-host stance), the SDK never touches `process` at all —
 * no global instrumentation, no transitive deps loaded, no boot
 * crash if something in that subtree is broken. Operators who
 * do want Sentry pay the import cost the moment the api starts ;
 * the rest of the app waits for `initSentryApi()` to resolve
 * before continuing (see `index.ts`).
 *
 * **`beforeSend` privacy contract.** Every event passes through
 * the hook below before being shipped. The hook strips :
 *   - Cookies (entire `request.cookies` object)
 *   - Headers known to carry crypto material (`x-sid`,
 *     `x-guard`, `cookie`, `authorization`)
 *   - Query strings (the whole `request.query_string`)
 *   - Request body (`request.data` set to undefined)
 *   - User context that can carry identifiable info (`user.email`,
 *     `user.username`, `user.ip_address`)
 *
 * Trade-off : we lose the ability to debug issues that depend on
 * the request body. Acceptable — crash signal + stack trace + URL
 * is enough for most cases ; for the rest, reproduce in dev.
 */
import { getConfig } from './config.ts';

/** Headers that must never reach Sentry. Match case-insensitively
 *  since Hono lowercases incoming header names but Sentry may pull
 *  them from native runtime APIs that preserve case. */
const HEADER_BLACKLIST = new Set([
  'cookie',
  'authorization',
  'x-sid',
  'x-guard',
]);

export async function initSentryApi(): Promise<void> {
  const { SENTRY_DSN, NODE_ENV, BUILD_COMMIT } = getConfig();
  if (!SENTRY_DSN) return;

  // Dynamic import : avoids pulling `@sentry/node` (and its heavy
  // transitive instrumentation graph) into the process when the
  // operator hasn't opted into Sentry. Also dodges any breakage
  // in that subtree on operators who don't care — see
  // commit history for the `@fastify/otel@0.18.0` package.json
  // corruption that briefly broke api boot for everyone before
  // this lazy path landed.
  const Sentry = await import('@sentry/node');

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NODE_ENV,
    release: BUILD_COMMIT === 'unknown' ? undefined : BUILD_COMMIT,
    // Don't sample performance traces — Nodea is a small self-host,
    // we only care about errors here. If perf monitoring becomes a
    // need, set `tracesSampleRate` per environment.
    tracesSampleRate: 0,
    // No PII in default events. Combined with `beforeSend`, this
    // double-locks the privacy contract.
    sendDefaultPii: false,
    beforeSend(event) {
      // Drop cookies, sensitive headers, query strings, and body
      // from any event before it leaves the process.
      if (event.request) {
        delete event.request.cookies;
        delete event.request.query_string;
        // `data` holds the request body — Sentry adds it when
        // integrations capture HTTP traffic. We strip it
        // unconditionally since /auth/* bodies contain crypto
        // material.
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
      // Strip user identifiers — even if some integration sets them,
      // they don't survive `beforeSend`.
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}
