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
 * Without this scrubber, a regression would silently re-leak the
 * exact same crypto material that SEC-01 removed. With it, even
 * a buggy commit cannot trip the audit.
 *
 * Strategy : install ourselves as the **log printer** of
 * `logger()` (it accepts a function in its constructor). The
 * printer redacts every value of every parameter named in
 * {@link REDACT_PARAMS} before delegating to `console.log`. This
 * leaves the actual `c.req.url` alone, so route handlers still
 * receive the real query string — only the console output is
 * redacted.
 *
 * The list is **whitelist-of-known-sensitive-names** rather than
 * a route-path allowlist : we don't trust ourselves to remember
 * every route that takes a sensitive param. Add new names to
 * {@link REDACT_PARAMS} as the API grows ; keep the list small
 * and explicit so the regex stays cheap.
 *
 * Reference: `docs/security-audit.md` Finding 1 (original SEC-01
 * scope) + GitHub issue #71 (broader opacity sweep).
 *
 * @example
 * ```ts
 * import { logger } from 'hono/logger';
 * import { redactingPrintFunc } from './middleware/sanitize-log-url';
 * app.use('*', logger(redactingPrintFunc));
 * ```
 */

/** Parameter names whose values must never reach the log stream.
 *  Add to this list (not removing) as new sensitive params surface. */
const REDACT_PARAMS = [
  // Crypto guards on encrypted-record mutations (legacy query-string
  // form ; post-SEC-01 they travel as `X-Guard`, but we keep the
  // entry here as a belt-and-suspenders against regressions).
  'd',
  'guard',
  'sid',
  // Magic-link / activation / reset / TOTP transit tokens.
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
