/**
 * Sentry `beforeSend` scrubber for the web bundle.
 *
 * WIRED in `src/sentry.ts` (`Sentry.init({ beforeSend })`) since
 * audit 2026-06 — the header previously claimed the SDK wasn't a
 * dependency, which had become false, and an inline subset ran in
 * its place letting breadcrumbs through. Exported as a pure
 * function so it stays unit-testable.
 *
 * Mirror of the API-side scrubber in
 * `packages/api/src/middleware/sentry-scrub.ts` — same contract,
 * adapted for browser-side events. The shared `redactQueryParams`
 * lives on the API side ; here we re-implement the small subset we
 * need without pulling the api module as a dep.
 *
 * Strategy (same as API side) : **scrub aggressively, ship the
 * minimum**. Sentry events are mostly useful for stack traces +
 * the originating route ; the surrounding context (URL query,
 * navigation breadcrumbs, fetch metadata, user PII) is where every
 * privacy leak hides.
 *
 * Browser-specific concerns :
 *   - The main key (in WebCrypto memory) is non-extractable, so it
 *     cannot end up in a Sentry event even by accident.
 *   - The OPAQUE export_key / KEK / wrapped blobs live in JS
 *     variables briefly during login ; any unhandled exception
 *     during that window could capture them in the stack trace's
 *     locals. Sentry's `attachStacktrace: false` (the default) is
 *     what guards this — DO NOT enable stack-locals capture.
 *   - LocalStorage / IndexedDB / window.* are scrubbed by Sentry's
 *     own integrations only if we install them. We add belt and
 *     suspenders by dropping the `extra` and `contexts` fields.
 *
 * Reference : GitHub issue #71 (broader opacity sweep).
 */

const REDACTED = '[redacted]';

const HEADER_ALLOWLIST = new Set(['content-type']);

/** Browser-side wholesale prefixes — paths whose entire query
 *  string must be redacted, regardless of param names. Keep in
 *  sync with the API-side list in
 *  `packages/api/src/middleware/sanitize-log-url.ts`. */
const WHOLESALE_PREFIXES = [
  '/auth/',
  '/mood/',
  '/goals/',
  '/journal/',
  '/library/',
  '/review/',
] as const;

/** Per-name denylist for paths outside the wholesale prefixes. */
const REDACT_PARAMS = [
  'd',
  'guard',
  'sid',
  't',
  'token',
  'code',
  'recovery_code',
  'email',
  'username',
  'session',
  'sid_token',
];

const REDACT_PATTERN = new RegExp(
  `([?&])(${REDACT_PARAMS.join('|')})=[^&\\s]*`,
  'g',
);

/** Browser-local twin of the API's `redactQueryParams`. Same shape
 *  + same rules, no shared module to avoid pulling api code into
 *  the web bundle. */
function redactQueryParams(input: string): string {
  return input.replace(/\S+/g, (token) => {
    const queryStart = token.indexOf('?');
    if (queryStart === -1) return token;
    const schemeEnd = token.indexOf('://');
    let pathStart = 0;
    if (schemeEnd !== -1) {
      const hostStart = schemeEnd + 3;
      const hostEnd = token.indexOf('/', hostStart);
      pathStart = hostEnd === -1 ? token.length : hostEnd;
    }
    const path = token.slice(pathStart, queryStart);
    if (WHOLESALE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      const head = token.slice(0, queryStart);
      const hashStart = token.indexOf('#', queryStart);
      const tail = hashStart === -1 ? '' : token.slice(hashStart);
      return `${head}?[redacted]${tail}`;
    }
    return token.replace(REDACT_PATTERN, `$1$2=${REDACTED}`);
  });
}

/** Minimal structural shape of a Sentry event we touch.
 *  Deliberately *wider* than what we read (`unknown` on fields we
 *  only overwrite) so the real `@sentry/react` `ErrorEvent`
 *  satisfies the generic constraint structurally — `query_string`
 *  can be a tuple array there, `user.id` can be a number. We avoid
 *  importing `@sentry/react` types here so the module stays
 *  loadable when the SDK chunk hasn't been pulled (DSN unset). */
export interface SentryEventLike {
  request?: {
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
  /** Sentry's free-form bag — we don't push anything here, but if
   *  a future integration starts to we'd rather drop it than
   *  accidentally leak. */
  extra?: Record<string, unknown>;
  /** Same rationale for `contexts` — Sentry stores device info,
   *  browser info, os info there. None of it is useful for an
   *  E2EE privacy-first app's bug triage. */
  contexts?: Record<string, unknown>;
}

/**
 * In-place scrub of a Sentry event before it leaves the browser.
 * Exported as a pure function for unit testing. Wire it up at
 * Sentry init time once the SDK is installed :
 *
 *     Sentry.init({
 *       dsn: import.meta.env.VITE_SENTRY_DSN,
 *       beforeSend: scrubSentryEvent,
 *       attachStacktrace: false,
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
    // `delete` rather than `= undefined` to satisfy strict
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

  // Drop the free-form bags entirely — browser device info, OS info
  // and any future integration's extras are not bug-triage value for
  // Nodea, and they're the most likely surface for accidental
  // leaks.
  if (event.extra !== undefined) delete event.extra;
  if (event.contexts !== undefined) delete event.contexts;

  return event;
}
