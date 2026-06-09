/**
 * Sentry `beforeSend` scrubber for the API process.
 *
 * WIRED in `src/sentry.ts` (`Sentry.init({ beforeSend })`) since
 * audit 2026-06 — the header previously claimed the SDK wasn't
 * installed, which had become false. Exported as a pure function
 * so it stays unit-testable.
 *
 * Strategy : **scrub aggressively, ship the minimum**. Sentry events
 * are mostly useful for stack traces + the originating route ; the
 * surrounding context (URL query, headers, body, cookies, user
 * PII) is where every privacy leak hides. We strip those wholesale
 * rather than chase what's safe on a case-by-case basis.
 *
 * Sources to keep :
 *   - `event.exception` (the stack trace itself)
 *   - `event.request.method` + `event.request.url` (path only)
 *   - `event.request.headers.content-type` (debug context)
 *   - `event.tags` (env, release, route name — we set these)
 *
 * Sources to scrub :
 *   - `event.request.query_string` → replaced via `redactQueryParams`
 *     so a sensitive param can't sneak through (defence in depth ;
 *     the api routes don't push the query string into Sentry by
 *     default, but a future SDK upgrade might start doing it)
 *   - `event.request.cookies` → `[redacted]`
 *   - `event.request.headers` (everything except `content-type`)
 *     → `[redacted]`
 *   - `event.request.data` (body) → `[redacted]`
 *   - `event.user` → drop email / username / ip (keep `id` only,
 *     and only because Sentry needs *something* to dedupe issues
 *     by user, but the UUID alone doesn't reveal PII)
 *   - `event.breadcrumbs[].data.url` → scrub query string
 *   - `event.breadcrumbs[]` with category in {`xhr`, `fetch`,
 *     `http`} → also scrub the `data.url`
 *
 * Reference : GitHub issue #71 (broader opacity sweep).
 */
import { redactQueryParams } from './sanitize-log-url.ts';

/**
 * Minimal shape of a Sentry event we care about. Deliberately
 * *wider* than what we read (`unknown` on fields we only
 * overwrite) so the real `@sentry/node` `ErrorEvent` satisfies the
 * generic constraint structurally — `query_string` can be a tuple
 * array there, `user.id` can be a number. We avoid importing
 * `@sentry/node` types here so the module stays loadable when the
 * SDK chunk hasn't been pulled (DSN unset).
 */
export interface SentryEventLike {
  request?: {
    method?: string;
    url?: string;
    query_string?: unknown;
    cookies?: unknown;
    headers?: Record<string, string>;
    data?: unknown;
  };
  user?: {
    id?: unknown;
    email?: unknown;
    username?: unknown;
    ip_address?: unknown;
    [key: string]: unknown;
  };
  breadcrumbs?: Array<{
    category?: string;
    data?: Record<string, unknown>;
    message?: string;
  }>;
  /** Free-form bags (device/os info, integration extras) — never
   *  useful for Nodea's triage, dropped wholesale. */
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
}

const REDACTED = '[redacted]';

/** Headers we keep in the scrubbed event — anything else is wiped.
 *  `content-type` is the only one that's both useful (debug context)
 *  and never sensitive. */
const HEADER_ALLOWLIST = new Set(['content-type']);

/**
 * In-place scrub of a Sentry event before it leaves the process.
 * The input shape is mutated and returned ; Sentry's `beforeSend`
 * contract accepts either a new event or null (drop entirely).
 *
 * Exported as a pure function for unit testing. Wire it up at
 * Sentry init time once the SDK is installed :
 *
 *     Sentry.init({
 *       dsn: env.SENTRY_DSN,
 *       beforeSend: scrubSentryEvent,
 *     });
 */
export function scrubSentryEvent<T extends SentryEventLike>(event: T): T {
  if (event.request) {
    if (typeof event.request.url === 'string') {
      event.request.url = redactQueryParams(event.request.url);
    }
    if (event.request.query_string !== undefined) {
      event.request.query_string = REDACTED;
    }
    if (event.request.cookies !== undefined) {
      event.request.cookies = REDACTED;
    }
    if (event.request.headers) {
      const kept: Record<string, string> = {};
      for (const [name, value] of Object.entries(event.request.headers)) {
        if (HEADER_ALLOWLIST.has(name.toLowerCase())) {
          kept[name] = value;
        }
      }
      event.request.headers = kept;
    }
    if (event.request.data !== undefined) {
      event.request.data = REDACTED;
    }
  }

  if (event.user) {
    // Keep `id` only — it's a UUID, not PII. Drop email, username,
    // ip. (Sentry dedups issues partially by user id ; keeping it
    // preserves "this exception affected N users" without leaking
    // who.) `delete` rather than `= undefined` to satisfy strict
    // `exactOptionalPropertyTypes`.
    if (event.user.id) {
      event.user = { id: event.user.id };
    } else {
      delete event.user;
    }
  }

  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (crumb.data && typeof crumb.data.url === 'string') {
        crumb.data.url = redactQueryParams(crumb.data.url);
      }
      // HTTP-family breadcrumbs sometimes carry the full request /
      // response data — scrub the data bag wholesale.
      if (
        crumb.category &&
        ['xhr', 'fetch', 'http'].includes(crumb.category)
      ) {
        if (crumb.data) {
          const scrubbedUrl =
            typeof crumb.data.url === 'string' ? crumb.data.url : undefined;
          crumb.data = scrubbedUrl ? { url: scrubbedUrl } : {};
        }
      }
    }
  }

  // Drop the free-form bags entirely — device/os info and any
  // future integration's extras are not triage value for Nodea,
  // and they're the most likely surface for accidental leaks.
  if (event.extra !== undefined) delete event.extra;
  if (event.contexts !== undefined) delete event.contexts;

  return event;
}
