/**
 * Shared auth-route helpers: the pre-auth rate limiters (`login`,
 * `request-reset`, `reset`) and a Postgres unique-violation matcher.
 *
 * Where: api auth route layer — factored here so the login / reset /
 * register route files share one limiter definition and one duplicate-key
 * detector (matched by SQLSTATE 23505 + constraint name, not the message).
 */
import { rateLimit } from '../middleware/rate-limit.ts';

/**
 * Match a Postgres unique-constraint violation by SQLSTATE +
 * constraint name. We used to string-match on `err.message`,
 * but drizzle-orm 0.45 no longer inlines the constraint name
 * there ; postgres.js always surfaces `code` (SQLSTATE
 * `23505` = unique_violation) and `constraint_name` on the
 * underlying error object.
 *
 * drizzle-orm 0.45+ wraps the underlying driver error in a
 * `DrizzleQueryError` that exposes the real postgres.js error
 * on `.cause`. Walk the chain so this helper keeps working
 * regardless of which ORM layer caught the throw.
 */
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  let e: unknown = err;
  while (typeof e === 'object' && e !== null) {
    const rec = e as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (rec.code === '23505' && rec.constraint_name === constraint) return true;
    if (rec.cause && rec.cause !== e) {
      e = rec.cause;
      continue;
    }
    return false;
  }
  return false;
}

/** Login rate limiter — 10 requests per minute per IP. Applied
 *  to `/login/start` and `/login/finish`. */
export const loginLimiter = rateLimit({
  max: 10,
  windowMs: 60_000,
  keyPrefix: 'login',
});

/** Password-reset request limiter — 5 requests per IP per hour
 *  (issue #22). Applied to `/request-reset`. */
export const requestResetLimiter = rateLimit({
  max: 5,
  windowMs: 60 * 60_000,
  keyPrefix: 'request-reset',
});

/** Reset consumption limiter — mild cap to slow any
 *  brute-force of stolen tokens. Applied to `/reset/start` and
 *  `/reset/finish`. */
export const resetLimiter = rateLimit({
  max: 10,
  windowMs: 60_000,
  keyPrefix: 'reset',
});
