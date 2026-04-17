/**
 * Vitest global setup — ensures tests always have a valid env and a clean DB
 * before each test file runs.
 */
import { beforeEach } from 'vitest';
import { sql } from '../db/client.ts';
import { __resetRateLimits } from '../middleware/rate-limit.ts';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for tests. Run: pnpm --filter @nodea/api test via the wrapper that loads .env.test',
  );
}

beforeEach(async () => {
  // TRUNCATE ... CASCADE wipes all three tables and resets FK state in one
  // round-trip. Much faster than DROP + migrate.
  await sql`TRUNCATE TABLE sessions, invites, users RESTART IDENTITY CASCADE`;
  __resetRateLimits();
});
