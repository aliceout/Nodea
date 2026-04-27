import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),

  /** Secret used to sign session cookies. Minimum 32 chars (~128 bits entropy). */
  COOKIE_SECRET: z.string().min(32),

  /** How long a session cookie is valid, in seconds. Default 30 days. */
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),

  /**
   * Trust cookies marked `Secure` — should be true in production behind TLS.
   * Defaults to false in dev so cookies work on plain HTTP localhost.
   */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  /**
   * Base URL the web app is served from. Used to build absolute `reset`
   * links in emails. No trailing slash. Example: `https://nodea.example.org`.
   */
  WEB_BASE_URL: z.string().url().optional(),

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
   * WebAuthn relying-party identifier (Auth-Spec §13.1, Phase 4).
   * **Required** — no default, per the "aucun secret hardcodé" rule
   * (Auth-Spec §13.1 / global-audit). Must match the registrable
   * domain the web app is served from (no scheme, no port). For
   * local dev set `WEBAUTHN_RP_ID=localhost`; for prod use the apex
   * domain, e.g. `nodea.example.org`.
   *
   * Mismatching `rpId` between enrollment and assertion makes every
   * passkey unverifiable — the browser refuses to surface
   * credentials for the wrong rpId.
   */
  WEBAUTHN_RP_ID: z.string().min(1),

  /**
   * Human-friendly relying-party name shown in the OS / browser
   * passkey UI (and in the user's password manager list). Free text;
   * keep it short. **Required** — no default.
   */
  WEBAUTHN_RP_NAME: z.string().min(1),

  /**
   * Origin allowed to use the rpId — full URL with scheme + port.
   * Must match the origin the browser sees when calling
   * `navigator.credentials.{create,get}`. **Required** — no default.
   *
   * For dev with the Nodea Vite shell, this is
   * `http://localhost:8089` (port pinned by `strictPort: true` in
   * `packages/web/vite.config.js`); for prod, the public origin.
   *
   * Multiple origins are not currently supported; if we ever need
   * them, pivot to a comma-separated list.
   */
  WEBAUTHN_ORIGIN: z.string().url(),
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
