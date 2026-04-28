import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Playwright configuration — Auth-Roadmap Phase 7D.
 *
 * Starts the full Nodea stack (api on :3000, web on :8089 via Vite
 * dev) before the test run, drives the browser through register /
 * login / Settings flows, and tears down at the end. Runs against
 * a dedicated `nodea_e2e` database — see `global-setup.ts`.
 *
 * **Pre-requirements** (the runner doesn't bootstrap these):
 *   - Postgres listening on :5433 (`docker compose up -d postgres`).
 *   - Mailpit listening on :1025 SMTP + :8025 HTTP API for email
 *     interception (`docker compose up -d mailpit` if you have it,
 *     otherwise install `apt install -y mailpit` or run via
 *     `mailpit` binary).
 *   - `.env` at the repo root with DATABASE_URL pointing at
 *     postgres + the WEBAUTHN_* + OPAQUE_SERVER_SETUP env vars.
 *
 * The webServer block redirects DATABASE_URL to `nodea_e2e` so
 * dev data isn't polluted; same trick the api test suite uses.
 */
export default defineConfig({
  testDir: './tests',
  // Tests are NOT independent at the DB level (some build on user
  // state from earlier tests). We rely on `globalSetup` to truncate
  // every table before each `playwright test` invocation, then run
  // serially within a single worker.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  globalSetup: './helpers/global-setup.ts',
  use: {
    baseURL: 'http://localhost:8089',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // API — Hono + Drizzle on port 3000.
      command: 'pnpm --filter @nodea/api start',
      cwd: REPO_ROOT,
      url: 'http://localhost:3000/healthz',
      timeout: 60_000,
      reuseExistingServer: !process.env['CI'],
      env: {
        // Override DATABASE_URL to the e2e database so the test run
        // doesn't pollute dev data. The base credentials come from
        // .env (loaded automatically by the api start script).
        DATABASE_URL:
          process.env['E2E_DATABASE_URL'] ??
          'postgres://nodea:Wise-Sinless6-Untainted-Unwed-Onward@127.0.0.1:5433/nodea_e2e',
        EMAIL_SERVICE_IMPL: 'smtp',
      },
    },
    {
      // Web — Vite dev server on port 8089.
      command: 'pnpm --filter @nodea/web dev',
      cwd: REPO_ROOT,
      url: 'http://localhost:8089',
      timeout: 60_000,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
