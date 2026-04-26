/**
 * Vitest global setup — ensures tests always have a valid env and a clean DB
 * before each test file runs.
 */
import { beforeEach } from 'vitest';
import { sql } from '../db/client.ts';
import { __resetRateLimits } from '../middleware/rate-limit.ts';
import { __getRecordingEmailService } from '../services/email/index.ts';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for tests. Run: pnpm --filter @nodea/api test via the wrapper that loads .env.test',
  );
}

beforeEach(async () => {
  // TRUNCATE ... CASCADE wipes every entry table, modules_config, invites,
  // sessions and users in one round-trip and resets FK state. Much faster
  // than DROP + migrate between tests.
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
      users
    RESTART IDENTITY CASCADE
  `;
  __resetRateLimits();
  __getRecordingEmailService().reset();
});
