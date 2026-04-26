import { defineConfig } from 'vitest/config';

// Load the repo-root `.env` (written by the Dev Setup VS Code
// extension from Infisical — see `dev-setup.yaml`) so DATABASE_URL /
// COOKIE_SECRET / … reach the test workers via `process.env`.
try {
  process.loadEnvFile?.('../../.env');
} catch {
  // Missing in CI — vars come straight from the environment instead.
}

// Force the recording EmailService impl in tests so suites can assert
// on outgoing mail without spinning up Mailpit or stubbing nodemailer.
// Overrides any `.env` value: dev defaults to `smtp` (Mailpit) and we
// don't want test runs polluting that path. The recording singleton
// is exposed via `__getRecordingEmailService()` from
// `services/email/index.ts`.
process.env.EMAIL_SERVICE_IMPL = 'recording';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Tests hit a real Postgres instance; keep them sequential to avoid
    // row-level interference across truncate cycles.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 20_000,
  },
});
