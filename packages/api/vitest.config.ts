import { defineConfig } from 'vitest/config';

// Load env before vitest spins up so DATABASE_URL / COOKIE_SECRET etc.
// reach the test workers via process.env. We try both locations, in
// priority order:
//   1. repo-root `.env` — written by the Dev Setup VS Code extension
//      from Infisical (see `dev-setup.yaml`).
//   2. package-local `.env` — legacy / manual fallback.
// The second file wins on key conflicts (explicit per-package override).
for (const path of ['../../.env', './.env']) {
  try {
    process.loadEnvFile?.(path);
  } catch {
    // Missing file is fine — CI can pass vars directly through the env.
  }
}

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
