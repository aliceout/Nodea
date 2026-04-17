import { defineConfig } from 'vitest/config';

// Load .env before vitest spins up so DATABASE_URL / COOKIE_SECRET reach the
// test workers via process.env.
process.loadEnvFile?.('./.env');

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
