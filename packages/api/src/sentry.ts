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
 * `scrubSentryEvent` (`middleware/sentry-scrub.ts`) before being
 * shipped. The scrubber strips : cookies, every header except
 * `content-type`, query strings (with `redactQueryParams` on the
 * URL itself), the request body, and user PII (`email`,
 * `username`, `ip_address` — the opaque `id` is kept for issue
 * dedup). Audit 2026-06 : the scrubber existed, was tested, but
 * was never wired here — an inline subset ran instead, letting
 * breadcrumbs through.
 *
 * **Breadcrumbs are disabled at the integration level.** The
 * default `Http` integration records every *outgoing* request as
 * a breadcrumb — including the library-lookup provider URLs that
 * carry the user's search text in clear
 * (`amazon.fr/s?k=<recherche>`, Google Books `?q=…`). The
 * `Console` integration records `console.warn` lines that name
 * the active module. Both bypass the `/flow` privacy invariant,
 * so we re-instantiate `Http` with `breadcrumbs: false` and drop
 * `Console` entirely. `scrubSentryEvent` still scrubs whatever
 * breadcrumbs remain, as a second layer.
 *
 * Trade-off : we lose the ability to debug issues that depend on
 * the request body. Acceptable — crash signal + stack trace + URL
 * is enough for most cases ; for the rest, reproduce in dev.
 */
import { getConfig } from './config.ts';
import { scrubSentryEvent } from './middleware/sentry-scrub.ts';

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
    // Outgoing-request and console breadcrumbs leak the user's
    // search text + the active module — see header comment.
    integrations: (defaults) => [
      ...defaults.filter((i) => i.name !== 'Http' && i.name !== 'Console'),
      Sentry.httpIntegration({ breadcrumbs: false }),
    ],
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}
