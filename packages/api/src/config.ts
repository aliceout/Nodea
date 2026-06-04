import { z } from 'zod';

/**
 * `z.url().optional()` is too strict for env vars sourced
 * from secret managers : Infisical (and `.env` files in general)
 * surface an "unset" key as an empty string, not as `undefined`.
 * The plain optional URL schema then fails validation with
 * « Invalid url » on an empty string, breaking boot whenever an
 * operator left a slot blank in their secret manager.
 *
 * This helper preprocesses empty / whitespace strings down to
 * `undefined` so the optional URL check only fires when the value
 * actually claims to be a URL.
 */
const optionalUrl = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.url().optional(),
  );

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.url(),

  /** Secret used to sign session cookies. Minimum 32 chars (~128 bits entropy). */
  COOKIE_SECRET: z.string().min(32),

  /** How long a session cookie is valid, in seconds. Default 30 days. */
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),

  /**
   * Cookies marked `Secure` — must be true in production behind TLS.
   *
   * **Fail-secure default (SEC-04).** Defaults to `'true'` so a deploy
   * that doesn't explicitly set `COOKIE_SECURE` cannot accidentally
   * issue session cookies over plain HTTP. For dev on `http://localhost`,
   * set `COOKIE_SECURE=false` in `.env` (the dev bootstrap does this
   * automatically). The fail-open default is gone — silently shipping
   * an insecure cookie in prod is the kind of regression that wasn't
   * worth the dev-friendliness it bought.
   */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  /**
   * Public address the app is served from. Two accepted shapes :
   *
   *   1. **Bare host** — registrable hostname only, no scheme,
   *      e.g. `nodea.app`. Canonical form on the VPS, because the
   *      `vps-install` repo publishes a single `ADDRESS` slot
   *      reused by every service it hosts (not just Nodea), and
   *      services append their own scheme + path as needed. Implies
   *      `https://` — the only sane choice in prod.
   *   2. **Full URL** — scheme + host (+ optional port), no
   *      trailing slash, e.g. `http://localhost:8089` for local
   *      dev or `https://nodea.example.org` for a custom prod
   *      setup that for some reason can't follow the bare-host
   *      convention.
   *
   * The `.transform()` block below normalises either input into a
   * single canonical URL and exposes it via `WEBAUTHN_ORIGIN` and
   * `WEB_BASE_URL`. Routes / emailers keep reading those derived
   * fields without caring which input shape was used.
   *
   * **Required** (SEC-10). Without it, every email link would render
   * as a relative URL — useless to the recipient because mail clients
   * can't resolve a relative path. The fail-fast at boot is preferable
   * to silently shipping broken links and forcing users to copy-paste
   * tokens from the email body.
   */
  ADDRESS: z
    .string()
    .min(1)
    .refine(
      (v) => {
        if (/^https?:\/\//i.test(v)) {
          try {
            new URL(v);
            return true;
          } catch {
            return false;
          }
        }
        // Bare host (optionally with `:port`). No whitespace, no slash,
        // no scheme separator. Keeps the check intentionally lenient —
        // the WHATWG URL parser is the real authority once we prepend
        // `https://` in the transform.
        return !/[\s/]/.test(v) && !v.includes('://');
      },
      'ADDRESS must be either a bare host (e.g. nodea.app) or a full URL (e.g. http://localhost:8089)',
    ),

  /**
   * SMTP transport. All optional — when unset, the mailer falls back
   * to a stderr "console transport" that logs the email instead of
   * sending it. This keeps dev / test happy without a real SMTP
   * server while still letting tests assert what would have been sent.
   */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /**
   * "From" address on outgoing mail. Accepts both the bare address
   * (`nodea@example.org`) and the full form (`Nodea <nodea@example.org>`).
   * Default is intentionally non-routable so tests don't attempt a real send.
   */
  SMTP_FROM: z.string().min(1).default('nodea@localhost.invalid'),

  /**
   * Picks which `EmailService` implementation is active at runtime.
   * See `packages/api/src/services/email/types.ts` for the contract
   * and Auth-Spec.md §10 for the design rationale.
   *
   *   - `smtp`      : real SMTP transport via nodemailer.
   *                   Default — points at Mailpit in dev (SMTP_HOST=mailpit
   *                   or 127.0.0.1, SMTP_PORT=1025) and Infomaniak in prod.
   *   - `console`   : log to stdout. Fallback only — pick this when running
   *                   without Docker (no Mailpit reachable).
   *   - `recording` : in-memory store for Vitest fixtures. Never use in
   *                   production — emails would never actually be sent.
   */
  EMAIL_SERVICE_IMPL: z.enum(['smtp', 'console', 'recording']).default('smtp'),

  /**
   * OPAQUE server static setup string (Auth-Spec §13.1, Phase 2 of
   * Auth-Roadmap). Output of `server.createSetup()` from
   * `@serenity-kit/opaque`, base64url-encoded by the lib. Required
   * once Phase 2 is in production — the server uses it to participate
   * in the OPAQUE protocol without ever seeing the user's password.
   *
   * Optional in this schema during the cutover so unrelated tests
   * (and pre-Phase-2 dev runs) don't have to provide it. The OPAQUE
   * route handlers will refuse to start if it's missing — callers
   * should use `getOpaqueServerSetup()` (in `auth/opaque.ts`) which
   * throws a clear error rather than reading the raw value.
   *
   * ROTATING IT INVALIDATES EVERY EXISTING ENVELOPE — issue #39
   * tracks the per-envelope versioning that lifts that constraint.
   */
  OPAQUE_SERVER_SETUP: z.string().min(1).optional(),

  /**
   * Optional Google Books API key, shared by all users on this Nodea
   * instance. Phase 2 of the Library module uses it to fetch book
   * metadata via `/library/lookup`. When unset, the proxy still works
   * — it just skips Google Books and falls back to Open Library / BNF
   * / Wikidata / BNE (none of which require a key).
   *
   * Storing this server-side (instead of per-user) means Google sees
   * "one Nodea instance" rather than "N individual users with N
   * different metadata profiles". Provision via your secrets manager
   * (Infisical) and surface via `.env`.
   */
  LIBRARY_GOOGLE_BOOKS_API_KEY: z.string().min(1).optional(),

  /**
   * Toggle the Amazon scraping adapter. Amazon serves an AWS WAF
   * JavaScript challenge to direct HTTP scrapers, so this adapter
   * runs through a headless Chromium (Puppeteer) that executes the
   * challenge JS in-browser — no manual puzzle solving needed,
   * Chromium does it the way every browser does it.
   *
   * Cost: ~200 MB Chromium binary on disk (downloaded by pnpm at
   * install time), ~120 MB RAM idle while the browser is alive,
   * +2-5 s per lookup vs the direct fetch providers. Set to
   * `false` to disable and skip the runtime browser entirely if
   * you don't want the overhead.
   */
  LIBRARY_AMAZON_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  /**
   * Registrable host the web app is served from — no scheme, no
   * port. Local dev: `localhost`. Prod: the apex domain, e.g.
   * `nodea.app`. **Required** — no default, per the "aucun secret
   * hardcodé" rule (Auth-Spec §13.1 / global-audit).
   *
   * Also used as the WebAuthn `rpId` (Auth-Spec §13.1, Phase 4) —
   * see the derived `WEBAUTHN_RP_ID` further down. Mismatching the
   * rpId between enrollment and assertion makes every passkey
   * unverifiable — the browser refuses to surface credentials for
   * the wrong rpId. Pick once at launch and never touch.
   *
   * On the VPS, this is published by the install repo
   * (aliceout/vps-install) alongside `ADDRESS` ; the Nodea app
   * piggybacks on it instead of holding its own duplicate entry
   * in Infisical.
   */
  DOMAIN: z.string().min(1),

  /**
   * Human-friendly relying-party name shown in the OS / browser
   * passkey UI (and in the user's password manager list). Free text;
   * keep it short. **Required** — no default.
   */
  WEBAUTHN_RP_NAME: z.string().min(1),

  /**
   * Build-time metadata exposed on the public `GET /version` endpoint.
   *
   * Set at image build time by the Dockerfile / CI pipeline (e.g.
   * `docker build --build-arg BUILD_COMMIT=$(git rev-parse HEAD)`). All
   * three default to `'unknown'` so the endpoint stays callable even
   * when the api is run from a workspace install that didn't go through
   * a build step (local dev `pnpm dev`).
   *
   * No semver `version` field — Nodea does not tag releases yet ; the
   * commit SHA is the unambiguous identifier. When tags arrive, add a
   * `BUILD_VERSION` env var and a `version` field on the response.
   */
  BUILD_COMMIT: z.string().min(1).default('unknown'),
  BUILD_DATE: z.string().min(1).default('unknown'),
  BUILD_BRANCH: z.string().min(1).default('unknown'),

  /**
   * Optional webhook URL pinged on every 5xx response. Discord
   * incoming webhook, Slack incoming webhook, or any HTTP endpoint
   * that accepts a JSON body with `content` / `text` fields.
   *
   * The middleware sends method + path (no query string) + status +
   * duration only — no request body, no headers, no error message.
   * See `middleware/error-webhook.ts` for the privacy contract.
   *
   * When unset (the default in dev), the middleware is a no-op.
   */
  ERROR_WEBHOOK_URL: optionalUrl(),

  /**
   * Optional Sentry DSN. When set, the api initialises `@sentry/node`
   * with an aggressive `beforeSend` that strips request bodies,
   * cookies, query strings and the `X-Sid` / `X-Guard` headers
   * before any event leaves the process. See `sentry.ts`.
   *
   * **Privacy tradeoff acknowledged.** Sentry is a third-party cloud
   * receiving stack traces + URLs + IPs. Even with maximum scrubbing,
   * a stack trace can reveal which module a user has enabled (a
   * crash in `Mood/context.tsx` says "this user uses Mood"). The
   * `/flow` privacy invariant doesn't extend to Sentry once a crash
   * happens — operators of Nodea who care about that should keep
   * SENTRY_DSN unset and rely on `ERROR_WEBHOOK_URL` only.
   *
   * When unset (the default in dev), Sentry stays uninitialised and
   * no events are captured.
   */
  SENTRY_DSN: optionalUrl(),
}).transform((env) => {
  // Normalise `ADDRESS` into a canonical URL with scheme and no
  // trailing slash. Bare host (`nodea.app`) becomes `https://nodea.app` ;
  // full URL is kept as-is, sans le `/` final. Every downstream consumer
  // sees the same shape regardless of which input the operator picked.
  const canonicalAddress = (/^https?:\/\//i.test(env.ADDRESS)
    ? env.ADDRESS
    : `https://${env.ADDRESS}`
  ).replace(/\/+$/, '');

  return {
    ...env,
    /**
     * Derived from `DOMAIN` — the WebAuthn rpId is the registrable
     * host (no scheme, no port). Kept as a separate config field so
     * the WebAuthn routes can keep reading `config.WEBAUTHN_RP_ID`
     * without caring how it's sourced.
     */
    WEBAUTHN_RP_ID: env.DOMAIN,
    /**
     * Canonical URL derived from `ADDRESS` (with scheme, no trailing
     * slash). The WebAuthn origin must match what the browser sees,
     * scheme included — the SPA is served from this same origin.
     */
    WEBAUTHN_ORIGIN: canonicalAddress,
    /**
     * Back-compat alias for `ADDRESS` (canonical URL form) — every
     * consumer in `routes/*.ts` and `services/email/*` reads
     * `config.WEB_BASE_URL`. Keeping the alias here avoids a sweep
     * across ~10 files just for a rename. New code should read the
     * canonical `WEB_BASE_URL` (or compute its own from
     * `config.ADDRESS` if it really needs the raw operator input).
     */
    WEB_BASE_URL: canonicalAddress,
  };
});

export type AppConfig = z.infer<typeof EnvSchema>;

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('[config] invalid environment variables:');
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  cached = parsed.data;
  return cached;
}
