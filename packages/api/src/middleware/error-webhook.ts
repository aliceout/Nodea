/**
 * Fire a fire-and-forget POST to a webhook URL whenever the api
 * answers a 5xx. The webhook is meant to wake the operator on
 * Discord / Slack / Mattermost / a custom relay — anything that
 * accepts an incoming JSON message with a `content` (Discord) or
 * `text` (Slack) field.
 *
 * Tier 1 étape C pas 1 (OPS-02). This is the api's only outbound
 * error signal: the Sentry SDK that once sat on top (pas 2) was
 * removed — unused, and a third-party cloud receiving stack traces
 * that can name the active module. Cheap and dep-free on purpose.
 *
 * **Privacy contract.** The payload sent to the webhook contains :
 *   - HTTP method (`POST`, `GET`, etc.)
 *   - Path (no query string)
 *   - Status code
 *   - Duration in ms
 *
 * It contains **NOTHING ELSE** — no body, no headers, no query
 * string, no IP, no cookies, no error message. This makes the
 * webhook URL safe to give to a third party (Discord cloud, a
 * Slack workspace) without leaking anything that would let the
 * recipient correlate activity to a user. The signal is « an
 * error happened on this route at this time » ; the *content* of
 * the error stays inside the api logs, which never leave the
 * server.
 *
 * **Path stripping.** The path is taken from `new URL(c.req.url)
 * .pathname`, never from `c.req.url` directly — so a stray
 * query string can't slip through. Encrypted-record routes are
 * module-agnostic (`/records`, the target collection travels in the
 * `X-Collection` header — issue #67), so the path doesn't name the
 * active module either.
 *
 * **Failure mode.** The fetch is fire-and-forget — the operator's
 * Slack going down must NEVER cascade into a user-facing request
 * failure. The promise's `.catch()` swallows the error silently
 * (the only thing left to surface it would be the very logger we
 * just declared as broken).
 *
 * @example
 * ```ts
 * import { errorWebhook } from './middleware/error-webhook';
 * import { getConfig } from './config';
 * app.use('*', errorWebhook(getConfig().ERROR_WEBHOOK_URL));
 * ```
 */
import type { MiddlewareHandler } from 'hono';

export function errorWebhook(url: string | undefined): MiddlewareHandler {
  // No-op when unset — keeps the middleware list flat in app.ts
  // without a conditional include there.
  if (!url) return async (_, next) => next();

  return async (c, next) => {
    const start = Date.now();
    await next();
    const status = c.res.status;
    if (status < 500) return;

    const path = new URL(c.req.url).pathname;
    const duration = Date.now() - start;
    const message = `[5xx] ${c.req.method} ${path} → ${status} (${duration} ms)`;

    // Cross-compatible body — Discord reads `content`, Slack reads
    // `text`. The other field is ignored by each, no harm in
    // sending both rather than branching on the URL.
    const body = JSON.stringify({ content: message, text: message });

    // `void` + `.catch` makes this fire-and-forget. Critically :
    // we do NOT `await` the fetch — the user's request must
    // return as fast as a healthy 5xx, regardless of whether the
    // webhook endpoint is reachable.
    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }).catch(() => {
      // Swallow. The webhook is observability infra — its outage
      // must never cascade into a user-visible failure.
    });
  };
}
