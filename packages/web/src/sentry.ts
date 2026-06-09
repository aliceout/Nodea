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
 * **`beforeSend` privacy contract.** Every event passes through
 * `scrubSentryEvent` (`core/sentry/sentry-scrub.ts`) : cookies,
 * every header except `content-type`, query strings, request
 * body, user PII, breadcrumb URLs, and the free-form
 * `extra`/`contexts` bags are all stripped or redacted. Audit
 * 2026-06 : the scrubber existed, was tested, but was never wired
 * here — an inline subset ran instead, letting breadcrumbs
 * through.
 *
 * **No BrowserTracing, no Replay, no Breadcrumbs.** The default
 * integrations ship navigations, clicks, console lines and
 * fetch/xhr URLs to Sentry as breadcrumbs / replays. That
 * bypasses the `/flow` privacy invariant — console lines name the
 * active module (`goals: toggle status failed`), fetch URLs
 * reveal `/library/lookup/*` usage. We filter all three out at
 * init time so they can never be silently re-enabled by a stale
 * config ; `scrubSentryEvent` still scrubs whatever breadcrumbs
 * remain, as a second layer.
 *
 * **Privacy tradeoff acknowledged.** Stack traces are still
 * shipped to Sentry's cloud, and a stack trace can leak which
 * module a user has enabled (an exception in `Mood/context.tsx`
 * tells Sentry "this user uses Mood"). Operators of Nodea who
 * care strictly about that should keep `VITE_SENTRY_DSN` unset.
 */
import { scrubSentryEvent } from './core/sentry/sentry-scrub';

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
    // metadata to Sentry through breadcrumbs / replays. The
    // `Breadcrumbs` integration is the one that records console
    // lines, DOM clicks and fetch URLs — see header comment.
    integrations: (defaults) =>
      defaults.filter(
        (i) =>
          i.name !== 'BrowserTracing' &&
          i.name !== 'Replay' &&
          i.name !== 'Breadcrumbs',
      ),
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}
