/**
 * Vitest global setup — ensures tests always have a valid env and a clean DB
 * before each test file runs.
 */
import { beforeEach } from 'vitest';
import { sql } from '../db/client.ts';
import { __resetRateLimits } from '../middleware/rate-limit.ts';
import { __resetLoginStates } from '../auth/opaque-login-state.ts';
import { __getRecordingEmailService } from '../services/email/index.ts';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for tests. Run: pnpm --filter @nodea/api test via the wrapper that loads .env.test',
  );
}

// Issue #41 — refuse to run if DATABASE_URL doesn't target a `_test`
// database. The TRUNCATE below would otherwise nuke the dev rows on
// every test run (which is exactly how the admin user disappeared
// before this guard existed). `vitest.config.ts` auto-swaps the dbname
// in the dev URL, so this branch only fires when someone manually
// overrode DATABASE_URL via `.env.test` to a non-`_test` value.
if (!/\/[^/?]*_test(?:\?|$)/.test(process.env.DATABASE_URL)) {
  throw new Error(
    `Refusing to run tests against a non-test database. DATABASE_URL must end with a "_test" dbname (got: ${process.env.DATABASE_URL.replace(
      /:[^:@]+@/,
      ':***@',
    )}). See packages/api/vitest.config.ts and issue #41.`,
  );
}

beforeEach(async () => {
  // TRUNCATE ... CASCADE wipes every entry table, modules_config, invites,
  // sessions and users in one round-trip and resets FK state. Much faster
  // than DROP + migrate between tests.
  //
  // `app_settings` has no user FK — it must be listed explicitly so
  // tests don't leak each other's `open_registration` toggles. Same
  // story for `email_verifications` rows that have a NULL `user_id`
  // (magic-link rows created before the user exists): those would not
  // be cascaded by the `users` truncate.
  await sql`
    TRUNCATE TABLE
      mood_entries,
      goals_entries,
      passage_entries,
      habits_items_entries,
      habits_logs_entries,
      library_items_entries,
      library_reviews_entries,
      review_entries,
      modules_config,
      user_preferences,
      announcements,
      password_reset_tokens,
      sessions,
      invites,
      app_settings,
      email_verifications,
      users
    RESTART IDENTITY CASCADE
  `;
  __resetRateLimits();
  __resetLoginStates();
  __getRecordingEmailService().reset();
});
