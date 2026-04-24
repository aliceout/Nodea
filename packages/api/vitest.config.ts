import { defineConfig } from 'vitest/config';

// Load the repo-root `.env` (written by the Dev Setup VS Code
// extension from Infisical — see `dev-setup.yaml`) so DATABASE_URL /
// COOKIE_SECRET / … reach the test workers via `process.env`.
try {
  process.loadEnvFile?.('../../.env');
} catch {
  // Missing in CI — vars come straight from the environment instead.
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
