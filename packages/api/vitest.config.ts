import { defineConfig } from 'vitest/config';

// Load the repo-root `.env` (written by the Dev Setup VS Code
// extension from Infisical — see `dev-setup.yaml`) so DATABASE_URL /
// COOKIE_SECRET / … reach the test workers via `process.env`.
try {
  process.loadEnvFile?.('../../.env');
} catch {
  // Missing in CI — vars come straight from the environment instead.
}

// Optional override layer for test-specific values. `.env.test` lives
// at the repo root (gitignored) and only exists if a dev wants to
// override DATABASE_URL or other vars beyond the default behaviour
// below. Most setups don't need to touch it — the dbname-swap below
// handles the common case.
try {
  process.loadEnvFile?.('../../.env.test');
} catch {
  // Missing → fall through to the auto-derivation below.
}

// Auto-redirect tests at the dedicated `nodea_test` database so the
// suite's TRUNCATE in `setup.ts` never wipes the dev rows (#41).
// Two layers of defence:
//   1. If `DATABASE_URL` from `.env` points at `nodea` (the dev DB),
//      swap the dbname to its `_test` sibling. Inherits the same
//      credentials so Infisical's rotated password keeps working
//      without anyone editing `.env.test`.
//   2. `setup.ts` further refuses to run when the resolved
//      `DATABASE_URL` doesn't end with `_test`, turning a config
//      mistake into a loud failure rather than silent data loss.
const url = process.env.DATABASE_URL;
if (url && !/\/[^/?]*_test(?:\?|$)/.test(url)) {
  // Replace the dbname in `postgres://user:pass@host:port/<name>?…`.
  // The regex captures everything after the last `/` (and before any
  // `?query`) and appends `_test` to it. Idempotent — running twice
  // doesn't double-suffix because the early return covers the
  // "already _test" case.
  process.env.DATABASE_URL = url.replace(
    /(\/)([^/?]+)(\?|$)/,
    (_match, slash: string, name: string, tail: string) =>
      `${slash}${name}_test${tail}`,
  );
}

// Force the recording EmailService impl in tests so suites can assert
// on outgoing mail without spinning up Mailpit or stubbing nodemailer.
// Overrides any `.env` value: dev defaults to `smtp` (Mailpit) and we
// don't want test runs polluting that path. The recording singleton
// is exposed via `__getRecordingEmailService()` from
// `services/email/index.ts`.
process.env.EMAIL_SERVICE_IMPL = 'recording';

export default defineConfig({
  // Tests hit a real Postgres instance; keep them sequential to avoid
  // row-level interference across truncate cycles. `pool` /
  // `poolOptions` moved out of `test:` in Vitest 4 — they're top-level
  // config now (cf. https://vitest.dev/guide/migration#pool-rework).
  pool: 'forks',
  poolOptions: { forks: { singleFork: true } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      // Tests, fixtures, ambient .d.ts, and build/migration scripts
      // don't count as production surface. Seed scripts are dev-only
      // tooling — they have their own fixture round-trip tests via
      // the e2e package, no need to count them here.
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.d.ts',
        'src/test/**',
        'src/seed/**',
        'src/seed.ts',
        'src/db/migrate.ts',
        'src/db/migrate-test.ts',
      ],
    },
  },
});
