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
