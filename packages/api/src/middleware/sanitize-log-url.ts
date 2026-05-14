/**
 * Custom log printer for Hono's `logger()` that strips auth
 * material from URLs before they hit stdout.
 *
 * Primary goal — defence in depth. After SEC-01 the encrypted-
 * collection mutations no longer pass `sid=` / `d=` in query
 * strings (those moved to `X-Sid` / `X-Guard` headers, see
 * [`require-guard.ts`](./require-guard.ts) and the web client
 * [`collection-client.ts`](../../../web/src/core/api/modules/collection-client.ts)).
 * Headers are not part of `hono/logger()`'s output, so the leak
 * is closed at the source. **This scrubber is the second layer**:
 * it catches any future regression — a code path that
 * accidentally re-introduces `?d=…`, a magic-link `?token=…`
 * arriving on a route that gets logged, an `?email=…` on a
 * lookup helper, etc.
 *
 * Two-tier strategy (issue #71 hardening) :
 *
 *   1. **Wholesale prefix redaction** — any request path under
 *      a privacy-sensitive prefix (`/auth/*`, `/<module>/*`)
 *      gets its **entire query string** nuked from the log line,
 *      regardless of param names. This is the safest default :
 *      a future route under these prefixes that adds a new
 *      sensitive param doesn't need to remember to update the
 *      denylist.
 *
 *   2. **Per-name denylist** — outside those prefixes, we still
 *      scrub a whitelist of known-sensitive param names. Catches
 *      one-off helpers (`/library/lookup/cover-fetch?url=…` would
 *      be under the wholesale `/library/` prefix anyway, but the
 *      denylist guards against accidental query-string param
 *      drift on routes we haven't carved out).
 *
 * Add new names to {@link REDACT_PARAMS} and new prefixes to
 * {@link WHOLESALE_REDACT_PREFIXES} as the API grows ; keep both
 * lists small and explicit so the regex stays cheap.
 *
 * Reference: GitHub issue #71 (broader opacity sweep).
 *
 * Module identifier privacy (issue #67) is no longer a residual gap
 * here : every encrypted collection is now reached through the
 * single `/records` endpoint, with the collection name carried in
 * the `X-Collection` header — neither Nginx's default access log
 * nor Hono's `logger()` records custom headers.
 *
 * @example
 * ```ts
 * import { logger } from 'hono/logger';
 * import { redactingPrintFunc } from './middleware/sanitize-log-url';
 * app.use('*', logger(redactingPrintFunc));
 * ```
 */

/**
 * Path prefixes whose request lines must have their entire query
 * string redacted, regardless of param names. The privacy floor :
 * for these routes, no `?…` content reaches the log at all.
 */
const WHOLESALE_REDACT_PREFIXES = [
  '/auth/',
  '/records',
] as const;

/** Parameter names whose values must never reach the log stream
 *  (used outside the wholesale prefixes above). Add to this list
 *  (not removing) as new sensitive params surface. */
const REDACT_PARAMS = [
  // Crypto guards on encrypted-record mutations (legacy query-string
  // form ; post-SEC-01 they travel as `X-Guard`, but we keep the
  // entry here as a belt-and-suspenders against regressions).
  'd',
  'guard',
  'sid',
  // Magic-link / activation / reset / TOTP transit tokens. `t` is
  // the short form used on the MFA-bypass confirm link
  // (`/auth/mfa/bypass/confirm?t=<token>`).
  't',
  'token',
  'code',
  'recovery_code',
  // PII that has no business in a request log even if a route ever
  // accepts it via query string (lookup helpers, debug endpoints).
  'email',
  'username',
  // Session-related. Cookies don't travel in URLs but a custom
  // helper might pass one — defence in depth.
  'session',
  'sid_token',
] as const;

const REDACT_PATTERN = new RegExp(
  `([?&])(${REDACT_PARAMS.join('|')})=[^&\\s]*`,
  'g',
);
const REDACTED = '__redacted__';

/** True when the supplied URL path starts with one of the
 *  wholesale-redact prefixes (cf. {@link WHOLESALE_REDACT_PREFIXES}). */
function isWholesalePath(path: string): boolean {
  return WHOLESALE_REDACT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Redact every sensitive param value in a URL string. If the URL's
 * path is under a wholesale-redact prefix, the whole query string
 * is replaced by `?__redacted__` ; otherwise the per-name denylist
 * applies.
 *
 * Works on both bare paths (`/foo?a=b`) and full URLs
 * (`https://host/foo?a=b`). Each whitespace-delimited substring
 * in the log message is scrubbed independently, so a line with
 * multiple URLs gets fully cleaned.
 */
export function redactQueryParams(input: string): string {
  return input.replace(/\S+/g, (token) => {
    const queryStart = token.indexOf('?');
    if (queryStart === -1) return token;
    // Resolve the path portion. For absolute URLs it starts after
    // `://host/` ; for relative paths it's the head of the string.
    const schemeEnd = token.indexOf('://');
    let pathStart = 0;
    if (schemeEnd !== -1) {
      const hostStart = schemeEnd + 3;
      const hostEnd = token.indexOf('/', hostStart);
      pathStart = hostEnd === -1 ? token.length : hostEnd;
    }
    const path = token.slice(pathStart, queryStart);
    if (isWholesalePath(path)) {
      const head = token.slice(0, queryStart);
      const hashStart = token.indexOf('#', queryStart);
      const tail = hashStart === -1 ? '' : token.slice(hashStart);
      return `${head}?${REDACTED}${tail}`;
    }
    // Outside wholesale prefixes : per-name scrub.
    return token.replace(REDACT_PATTERN, `$1$2=${REDACTED}`);
  });
}

/**
 * Drop-in replacement for the default `console.log` Hono uses.
 * Sanitises the message + each remaining argument that happens
 * to be a string (defensive — Hono's logger only passes one
 * string today, but a future change could add more).
 */
export function redactingPrintFunc(message: string, ...rest: string[]): void {
  // eslint-disable-next-line no-console
  console.log(
    redactQueryParams(message),
    ...rest.map((s) => (typeof s === 'string' ? redactQueryParams(s) : s)),
  );
}
