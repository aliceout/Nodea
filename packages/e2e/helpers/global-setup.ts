import postgres from 'postgres';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Global setup — runs once before all Playwright tests.
 *
 *   1. Make sure the `nodea_e2e` database exists (CREATE if not).
 *   2. Run Drizzle migrations against it.
 *   3. Truncate every user-data table so the test run starts clean.
 *
 * Tests are NOT independent — some build on user state from
 * earlier tests. We rely on this clean-slate setup + serial
 * execution (workers: 1 in playwright.config.ts) to keep things
 * reproducible.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const E2E_DB_URL =
  process.env['E2E_DATABASE_URL'] ??
  'postgres://nodea:Wise-Sinless6-Untainted-Unwed-Onward@127.0.0.1:5433/nodea_e2e';

// Server-admin URL — same Postgres but pointed at the default
// `postgres` database so we can issue CREATE DATABASE.
const ADMIN_URL = E2E_DB_URL.replace(/\/[^/?]+(\?|$)/, '/postgres$1');

async function ensureDatabaseExists(): Promise<void> {
  const dbName = E2E_DB_URL.match(/\/([^/?]+)(?:\?|$)/)?.[1];
  if (!dbName) throw new Error(`Could not parse db name from ${E2E_DB_URL}`);
  const admin = postgres(ADMIN_URL, { max: 1, prepare: false });
  try {
    const rows = await admin`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;
    if (rows.length === 0) {
      // postgres-js doesn't support CREATE DATABASE in a normal
      // template literal because it'd want to bind the name as a
      // parameter; use unsafe() since we control the value.
      await admin.unsafe(`CREATE DATABASE "${dbName}"`);
       
      console.log(`[e2e/setup] created database ${dbName}`);
    }
  } finally {
    await admin.end();
  }
}

function runMigrations(): void {
  // Reuse the api's existing migration script. We override
  // DATABASE_URL via env so it runs against `nodea_e2e` rather
  // than dev `nodea`.
  execSync('pnpm --filter @nodea/api db:migrate', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: E2E_DB_URL },
  });
}

async function truncateAll(): Promise<void> {
  const sql = postgres(E2E_DB_URL, { max: 1, prepare: false });
  try {
    // CASCADE is important — sessions / opaque_records / auth_factors
    // / mfa_* / *_entries all FK back to users.
    await sql`TRUNCATE TABLE
      users, invites, password_reset_tokens, app_settings,
      announcements, modules_config, user_preferences,
      mood_entries, goals_entries, journal_entries,
      habits_items_entries, habits_logs_entries,
      library_items_entries, library_reviews_entries,
      review_entries
    RESTART IDENTITY CASCADE`;
    // Seed `open_registration = true` so /register renders the
    // public form (else the « Sur invitation » panel takes over,
    // because the schema defaults to 'false' when the row is
    // absent). This used to rely on a manually-configured dev api
    // being reused via `reuseExistingServer: true` ; now that
    // Playwright spawns its own api each run (#95 fix), the
    // setting has to be seeded explicitly.
    await sql`
      INSERT INTO app_settings (key, value) VALUES ('open_registration', 'true')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  } finally {
    await sql.end();
  }
}

async function resetRateLimits(): Promise<void> {
  // The in-process rate-limit buckets in `packages/api/src/middleware/rate-limit.ts`
  // survive a `reuseExistingServer: true` Playwright run. Hitting the dev
  // test endpoint flushes them so the 13-spec sequence doesn't run into
  // /auth/register's 10/h bucket halfway through.
  //
  // Sends the `X-Test-Secret` header that the api's `/__test__/*` gate
  // requires post-v2.8.0 hardening. When unset (legacy local runs), the
  // request goes through without it ; the api will then 403 it and the
  // catch below silently swallows so a custom prod-like build (where
  // the route doesn't even mount) doesn't break the setup.
  const apiUrl = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
  const secret = process.env['E2E_TEST_HARNESS_SECRET'] ?? '';
  const headers: Record<string, string> = secret
    ? { 'x-test-secret': secret }
    : {};
  try {
    await fetch(`${apiUrl}/__test__/reset-rate-limits`, {
      method: 'POST',
      headers,
    });
  } catch {
    // Endpoint may not exist on a custom prod-like build; skip silently.
  }
}

export default async function globalSetup(): Promise<void> {
  await ensureDatabaseExists();
  runMigrations();
  await truncateAll();
  await resetRateLimits();

  console.log('[e2e/setup] database ready');
}
