/**
 * Custom log printer for Hono's `logger()` that strips auth
 * material from URLs before they hit stdout.
 *
 * The collection factory (PATCH / DELETE on encrypted records)
 * passes the HMAC guard via the `d=…` query parameter — see
 * [`packages/web/src/core/api/modules/collection-client.ts`](../../../web/src/core/api/modules/collection-client.ts).
 * Hono's default `logger()` middleware logs `<method> <url>`, so
 * without sanitisation every mutation produces a log line of
 * the shape :
 *
 *   PATCH /mood/records/abc?sid=m_xxx&d=g_<hex_64> 200 5ms
 *
 * The guard IS the auth token for that record — leaking it in
 * logs lets anyone with log access (ops, log aggregators,
 * sidecar processes) forge mutations without holding the main
 * key. CLAUDE.md §Error handling & logging is explicit :
 *
 *   « Never log secrets, tokens, session cookies, or raw crypto
 *     material — not even at debug. »
 *
 * Strategy : install ourselves as the **log printer** of
 * `logger()` (it accepts a function in its constructor). The
 * printer redacts `d=…` and `token=…` values before delegating
 * to `console.log`. This leaves the actual `c.req.url` alone, so
 * route handlers still receive the real query string — only the
 * console output is redacted.
 *
 * Add new redactions to {@link REDACT_PARAMS} as new auth params
 * surface ; keep the list small and explicit so the regex stays
 * cheap.
 *
 * Reference: `docs/security-audit.md` Finding 1.
 *
 * @example
 * ```ts
 * import { logger } from 'hono/logger';
 * import { redactingPrintFunc } from './middleware/sanitize-log-url';
 * app.use('*', logger(redactingPrintFunc));
 * ```
 */

const REDACT_PARAMS = ['d', 'token'] as const;
const REDACT_PATTERN = new RegExp(
  `([?&])(${REDACT_PARAMS.join('|')})=[^&\\s]*`,
  'g',
);
const REDACTED = '__redacted__';

export function redactQueryParams(input: string): string {
  return input.replace(REDACT_PATTERN, `$1$2=${REDACTED}`);
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
