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
